import { generateCandidates, getRecommendedActionsForFaultId } from "@/lib/detective/candidates";
import {
  computeDiagnosticConfidence,
  computeUncertainty,
  countPlausibleCauses,
  getTopFault,
  updateBeliefs,
} from "@/lib/detective/belief";
import {
  applyQuestionAnswer,
  getQuestionDef,
  selectNextQuestion,
  type QuestionContext,
} from "@/lib/detective/questions";
import type {
  DetectiveSnapshot,
  DiagnosticSession,
  MachineConfigurationSnapshot,
  Observation,
} from "@/lib/detective/schemas";

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}-${now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferConfigFromComplaint(complaint: string): MachineConfigurationSnapshot {
  const lower = complaint.toLowerCase();
  const config: MachineConfigurationSnapshot = {};
  if (/flux/i.test(lower)) config.process = "flux";
  else if (/mig|solid/i.test(lower)) config.process = "mig";
  else if (/tig/i.test(lower)) config.process = "tig";
  else if (/stick/i.test(lower)) config.process = "stick";
  return config;
}

function questionContext(session: DiagnosticSession): QuestionContext {
  return {
    complaint: session.originalComplaint,
    process: session.machineConfiguration.process,
    wireType: session.machineConfiguration.wireType,
    askedQuestionIds: session.questionsAsked.map((q) => q.id),
  };
}

function refreshSessionMetrics(session: DiagnosticSession): DiagnosticSession {
  const uncertainty = computeUncertainty(session.candidateFaults);
  const plausibleCauseCount = countPlausibleCauses(session.candidateFaults);
  const currentQuestion = selectNextQuestion(session.candidateFaults, questionContext(session));

  let finalResolution = session.finalResolution;
  const top = getTopFault(session.candidateFaults);
  if (
    !finalResolution &&
    plausibleCauseCount === 1 &&
    top &&
    top.score > 0.55 &&
    session.questionsAsked.length >= 1
  ) {
    finalResolution = {
      summary: `Most likely cause: ${top.label}`,
      primaryFaultId: top.id,
      recommendedActions: getRecommendedActionsForFaultId(top.faultId),
      citations: top.supportEvidence,
    };
  }

  return {
    ...session,
    uncertainty,
    diagnosticConfidence: computeDiagnosticConfidence(uncertainty),
    plausibleCauseCount,
    currentQuestion,
    finalResolution,
    updatedAt: now(),
  };
}

export function startDiagnosticSession(
  complaint: string,
  sessionId?: string,
  config?: MachineConfigurationSnapshot,
): DiagnosticSession {
  const mergedConfig = { ...inferConfigFromComplaint(complaint), ...config };
  const candidates = generateCandidates(complaint, mergedConfig);
  const ts = now();

  const session: DiagnosticSession = {
    id: sessionId ?? makeId("detective"),
    originalComplaint: complaint,
    machineConfiguration: mergedConfig,
    observations: [],
    candidateFaults: candidates,
    eliminatedFaultIds: [],
    uncertainty: 1,
    questionsAsked: [],
    actionsAttempted: [],
    safetyState: {
      acknowledged: false,
      warnings: [
        "Stop welding if you smell gas, hear popping from the machine, or see damaged cables.",
      ],
      blockers: [],
    },
    diagnosticConfidence: 0,
    plausibleCauseCount: countPlausibleCauses(candidates),
    createdAt: ts,
    updatedAt: ts,
  };

  return refreshSessionMetrics(session);
}

function buildObservation(text: string, effect: ReturnType<typeof applyQuestionAnswer>): Observation {
  return {
    id: makeId("obs"),
    text,
    source: "user",
    supportsFaultIds: effect.supportsFaultIds ?? effect.boostFaultIds ?? [],
    contradictsFaultIds: effect.contradictsFaultIds ?? effect.eliminateFaultIds ?? [],
    timestamp: now(),
  };
}

export function answerDiagnosticQuestion(
  session: DiagnosticSession,
  questionId: string,
  answer: string,
): DiagnosticSession {
  const qDef = getQuestionDef(questionId);
  const ctx = questionContext(session);
  const effect = applyQuestionAnswer(questionId, answer, session.candidateFaults, ctx);

  const observation = buildObservation(effect.observationText ?? answer, effect);

  const configPatch = (effect.configPatch ?? {}) as Partial<MachineConfigurationSnapshot>;
  const eliminatedFaultIds = [
    ...new Set([...session.eliminatedFaultIds, ...(effect.eliminateFaultIds ?? [])]),
  ];

  let faults = updateBeliefs(session.candidateFaults, session, {
    observation,
    configPatch,
    eliminateFaultIds: effect.eliminateFaultIds,
    boostFaultIds: effect.boostFaultIds,
    penalizeFaultIds: effect.penalizeFaultIds,
  });

  faults = faults.map((f) =>
    eliminatedFaultIds.includes(f.id) ? { ...f, eliminated: true, score: 0 } : f,
  );

  const updated: DiagnosticSession = {
    ...session,
    machineConfiguration: { ...session.machineConfiguration, ...configPatch },
    observations: [...session.observations, observation],
    candidateFaults: faults,
    eliminatedFaultIds,
    questionsAsked: [
      ...session.questionsAsked,
      {
        id: questionId,
        text: qDef?.text ?? questionId,
        rationale: qDef?.rationale ?? "",
        askedAt: now(),
        answer,
      },
    ],
  };

  return refreshSessionMetrics(updated);
}

export function markAlreadyChecked(
  session: DiagnosticSession,
  questionId: string,
  result: string,
): DiagnosticSession {
  const qDef = getQuestionDef(questionId);
  const updated = answerDiagnosticQuestion(session, questionId, result);
  return {
    ...updated,
    actionsAttempted: [
      ...session.actionsAttempted,
      `Checked: ${qDef?.text ?? questionId} → ${result}`,
    ],
  };
}

export function addObservation(
  session: DiagnosticSession,
  text: string,
  supportsFaultIds: string[] = [],
  contradictsFaultIds: string[] = [],
  source: Observation["source"] = "user",
): DiagnosticSession {
  const observation: Observation = {
    id: makeId("obs"),
    text,
    source,
    supportsFaultIds,
    contradictsFaultIds,
    timestamp: now(),
  };

  const faults = updateBeliefs(session.candidateFaults, session, { observation });
  const updated: DiagnosticSession = {
    ...session,
    observations: [...session.observations, observation],
    candidateFaults: faults,
  };
  return refreshSessionMetrics(updated);
}

export function startOver(complaint?: string): DiagnosticSession {
  const text = complaint ?? "";
  return startDiagnosticSession(text || "New diagnostic session");
}

export function buildSnapshot(session: DiagnosticSession): DetectiveSnapshot {
  const ranked = [...session.candidateFaults]
    .filter((f) => !f.eliminated)
    .sort((a, b) => b.score - a.score);
  const eliminated = session.candidateFaults.filter((f) => f.eliminated);

  return {
    session,
    rankedHypotheses: ranked,
    eliminatedFaults: eliminated,
    whyThisQuestion: session.currentQuestion?.rationale,
  };
}

export function getWhyAskingExplanation(session: DiagnosticSession): string {
  const q = session.currentQuestion;
  if (!q) return "No further clarifying questions needed at this time.";
  return `${q.rationale} (Expected diagnostic value: ${Math.round(q.expectedInfoGain * 100)}%, separates ~${q.separatesFaultCount} causes, effort: ${q.effort}, safety: ${q.safetyRisk})`;
}
