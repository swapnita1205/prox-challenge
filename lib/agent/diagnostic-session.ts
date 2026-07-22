import type { DiagnosticState } from "@/lib/agent/schemas";
import type { Hypothesis } from "@/lib/schemas/conversation";
import {
  answerDiagnosticQuestion,
  buildSnapshot,
  getWhyAskingExplanation,
  startDiagnosticSession as engineStart,
} from "@/lib/detective/engine";
import type { DiagnosticSession as DetectiveSession } from "@/lib/detective/schemas";
import {
  loadServerSession,
  resetServerSessions,
  saveServerSession,
} from "@/lib/detective/persist";

/** Agent-facing session handle (wraps Machine Detective session). */
export interface DiagnosticSession {
  id: string;
  symptoms: string[];
  hypotheses: Hypothesis[];
  askedQuestions: string[];
  ruledOutFaultIds: string[];
  evidenceSummary?: string;
  questionRationale?: string;
  createdAt: number;
  updatedAt: number;
  /** Full detective session for advanced consumers */
  detective: DetectiveSession;
}

function detectiveToAgentSession(detective: DetectiveSession): DiagnosticSession {
  const snapshot = buildSnapshot(detective);
  return {
    id: detective.id,
    symptoms: [detective.originalComplaint],
    hypotheses: snapshot.rankedHypotheses.map((f) => ({
      id: f.id,
      label: f.label,
      posterior: f.score,
      evidence: f.supportEvidence.map((e) => `${e.source} p.${e.page}`),
      ruledOut: f.eliminated,
    })),
    askedQuestions: detective.questionsAsked.map((q) => q.text),
    ruledOutFaultIds: detective.eliminatedFaultIds,
    evidenceSummary: detective.finalResolution?.summary,
    questionRationale: detective.currentQuestion?.rationale,
    createdAt: detective.createdAt,
    updatedAt: detective.updatedAt,
    detective,
  };
}

export function startDiagnosticSession(input: {
  sessionId?: string;
  symptoms?: string[];
  primarySymptom?: string;
}): DiagnosticSession {
  const symptoms = input.symptoms?.length
    ? input.symptoms
    : input.primarySymptom
      ? [input.primarySymptom]
      : [];
  const complaint = symptoms[0] ?? "unknown symptom";
  const detective = engineStart(complaint, input.sessionId);
  saveServerSession(detective);
  return detectiveToAgentSession(detective);
}

export function updateDiagnosticSession(input: {
  sessionId: string;
  newSymptoms?: string[];
  ruledOutHypothesisIds?: string[];
  answeredQuestion?: string;
  evidenceSummary?: string;
  questionRationale?: string;
}): DiagnosticSession | null {
  const existing = loadServerSession(input.sessionId);
  if (!existing) return null;

  let detective = existing;

  if (input.answeredQuestion && detective.currentQuestion) {
    detective = answerDiagnosticQuestion(
      detective,
      detective.currentQuestion.id,
      input.answeredQuestion,
    );
  }

  if (input.ruledOutHypothesisIds?.length) {
    detective = {
      ...detective,
      eliminatedFaultIds: [
        ...new Set([...detective.eliminatedFaultIds, ...input.ruledOutHypothesisIds]),
      ],
      candidateFaults: detective.candidateFaults.map((f) =>
        input.ruledOutHypothesisIds!.includes(f.id)
          ? { ...f, eliminated: true, score: 0 }
          : f,
      ),
    };
  }

  if (input.evidenceSummary && detective.finalResolution) {
    detective = {
      ...detective,
      finalResolution: { ...detective.finalResolution, summary: input.evidenceSummary },
    };
  }

  saveServerSession(detective);
  return detectiveToAgentSession(detective);
}

export function getDiagnosticSession(sessionId: string): DiagnosticSession | undefined {
  const detective = loadServerSession(sessionId);
  return detective ? detectiveToAgentSession(detective) : undefined;
}

export function sessionToDiagnosticState(session: DiagnosticSession): DiagnosticState {
  const nextQuestion = session.detective.currentQuestion;
  return {
    sessionId: session.id,
    symptoms: session.symptoms,
    hypotheses: session.hypotheses.filter((h) => !h.ruledOut).slice(0, 5),
    askedQuestions: session.askedQuestions,
    ruledOutFaultIds: session.ruledOutFaultIds,
    evidenceSummary: session.evidenceSummary,
    questionRationale:
      session.questionRationale ??
      (nextQuestion ? getWhyAskingExplanation(session.detective) : undefined),
  };
}

export function resetDiagnosticSessions(): void {
  resetServerSessions();
}
