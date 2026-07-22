import type { AgentIntent, AgentResponse } from "@/lib/agent/schemas";
import type { MachineState } from "@/lib/schemas/conversation";
import { getKnowledgeGraph } from "@/lib/knowledge/build";
import { validateConfiguration } from "@/lib/knowledge/queries";
import { INGEST_PROCESS_MAP } from "@/lib/knowledge/canonical";
import {
  missingFieldReasons,
  requiredMissingFields,
} from "@/lib/agent/clarification-policy";
import {
  detectDangerousProcedures,
  detectInventedSettingsClaims,
  detectOutOfScope,
  detectPolarityConflict,
  detectProcessMix,
  detectVisualOverconfidence,
  detectVoltageConflict,
  extractClaims,
} from "@/lib/grounding/claims";
import type {
  EvidenceCoverage,
  GroundingResult,
  GroundingStatus,
  HowReachedPanel,
} from "@/lib/grounding/schemas";
import { STATUS_LABELS } from "@/lib/grounding/schemas";

export interface GroundingInput {
  response: AgentResponse;
  userMessage: string;
  machineState?: MachineState;
  toolSummaries?: string[];
}

function computeCoverage(claims: ReturnType<typeof extractClaims>): EvidenceCoverage {
  const direct = claims.filter((c) => c.evidenceLevel === "direct").length;
  const indirect = claims.filter((c) => c.evidenceLevel === "indirect").length;
  const calculated = claims.filter((c) => c.evidenceLevel === "calculated").length;
  const unsupported = claims.filter((c) => c.evidenceLevel === "unsupported").length;
  const total = claims.length || 1;
  const supported = direct + indirect + calculated;
  return {
    claimsMade: claims.length,
    directEvidence: direct,
    indirectEvidence: indirect,
    calculatedEvidence: calculated,
    unsupportedClaims: unsupported,
    coverageScore: Math.round((supported / total) * 100) / 100,
  };
}

function buildHowReached(
  input: GroundingInput,
  contradictions: string[],
  limitations: string[],
): HowReachedPanel {
  const { response, userMessage, machineState } = input;
  const manualFacts = response.citations.map((c) => {
    const excerpt = c.excerpt ? ` — ${c.excerpt.slice(0, 120)}` : "";
    return `${c.source} p.${c.page}${c.section ? ` (${c.section})` : ""}${excerpt}`;
  });

  const observations = [
    ...(machineState?.symptoms ?? []),
    ...(response.diagnosticState?.symptoms ?? []),
  ];
  if (userMessage && !observations.includes(userMessage)) {
    observations.push(userMessage.slice(0, 200));
  }

  const hypotheses =
    response.diagnosticState?.hypotheses?.map((h) => `${h.label} (${Math.round(h.posterior * 100)}%)`) ??
    machineState?.hypotheses?.map((h) => `${h.label} (${Math.round(h.posterior * 100)}%)`) ??
    [];

  return {
    manualFactsUsed: manualFacts,
    userObservations: observations.slice(0, 5),
    hypothesesConsidered: hypotheses.slice(0, 6),
    contradictionsFound: contradictions,
    reasonForNextQuestion:
      response.diagnosticState?.questionRationale ??
      (response.clarifyingQuestion ? `Clarifying: ${response.clarifyingQuestion}` : undefined),
    confidenceLimitations: limitations,
  };
}

function validateConfigurationFromState(
  answer: string,
  machineState?: MachineState,
): string[] {
  if (!machineState?.process) return [];
  const processId = INGEST_PROCESS_MAP[machineState.process] ?? `process-${machineState.process}`;
  const graph = getKnowledgeGraph();
  const result = validateConfiguration(graph, {
    id: "grounding-check",
    processId,
    inputVoltage: machineState.inputVoltage,
    consumableIds: [],
    componentIds: [],
  });

  const issues: string[] = [];
  for (const c of result.contradictions) {
    if (c.verificationStatus === "verified") issues.push(c.message);
  }

  const lower = answer.toLowerCase();
  if (machineState.process === "flux" && /dcep/i.test(answer) && !/tig/i.test(lower)) {
    issues.push("Stated machine configuration is flux but answer recommends DCEP polarity.");
  }
  if (machineState.process === "mig" && /dcen/i.test(answer) && !/tig/i.test(lower)) {
    issues.push("Stated machine configuration is MIG but answer recommends DCEN polarity.");
  }

  return issues;
}

/**
 * Delegates to the deterministic ClarificationPolicy so grounding never
 * flags "clarification_required" for a pure information request (e.g.
 * "show me the wire feed mechanism") just because its intent overlaps with
 * setup/settings vocabulary. Only genuine configuration requests missing
 * required detail (process/material/thickness) land here.
 */
function missingRequiredParameters(
  intent: AgentIntent,
  userMessage: string,
  machineState?: MachineState,
): string[] {
  const fields = requiredMissingFields({ message: userMessage, intent, machineState });
  return missingFieldReasons(fields);
}

function determineStatus(params: {
  blockers: string[];
  conflicts: string[];
  missing: string[];
  coverage: EvidenceCoverage;
  hasClarifyingQuestion: boolean;
  confidence: string;
  machineClaimsUnsupported: number;
}): GroundingStatus {
  if (params.blockers.length > 0) return "blocked_for_safety";
  if (params.conflicts.length > 0) return "conflicting_sources";
  if (params.missing.length > 0 || params.hasClarifyingQuestion) return "clarification_required";
  if (
    params.coverage.unsupportedClaims > 0 &&
    params.machineClaimsUnsupported > 0 &&
    (params.coverage.coverageScore < 0.5 || params.machineClaimsUnsupported >= 2)
  ) {
    return "insufficient_manual_evidence";
  }
  if (
    params.coverage.unsupportedClaims > 0 ||
    params.confidence === "low" ||
    params.coverage.coverageScore < 0.85
  ) {
    return "grounded_with_uncertainty";
  }
  return "grounded";
}

export function groundResponse(input: GroundingInput): GroundingResult {
  const { response, userMessage, machineState, toolSummaries = [] } = input;
  const claims = extractClaims(
    response.answer,
    response.citations,
    toolSummaries,
    response.intent,
  );

  const coverage = computeCoverage(claims);
  const polarityConflicts = detectPolarityConflict(response.answer, response.citations);
  const voltageConflicts = detectVoltageConflict(response.answer);
  const processMix = detectProcessMix(response.answer);
  const visualIssues = detectVisualOverconfidence(response.answer, response.intent);
  const configIssues = validateConfigurationFromState(response.answer, machineState);
  const outOfScopeIssues = detectOutOfScope(response.answer, userMessage);
  const inventedSettingsIssues = detectInventedSettingsClaims(
    response.answer,
    toolSummaries,
  );
  const { blockers: safetyBlockers, warnings: safetyWarnings } = detectDangerousProcedures(
    response.answer,
    response.safetyNotices,
    userMessage,
  );
  const missing = missingRequiredParameters(response.intent, userMessage, machineState);

  const contradictions = [
    ...polarityConflicts,
    ...voltageConflicts,
    ...processMix,
    ...visualIssues,
    ...configIssues,
    ...outOfScopeIssues,
    ...inventedSettingsIssues,
  ];

  const machineClaimsUnsupported = claims.filter(
    (c) =>
      (c.kind === "machine" || c.kind === "numeric" || c.kind === "configuration") &&
      c.evidenceLevel === "unsupported",
  ).length;

  const limitations: string[] = [];
  if (coverage.unsupportedClaims > 0) {
    limitations.push(`${coverage.unsupportedClaims} claim(s) lack direct manual citation.`);
  }
  if (response.confidence === "low") {
    limitations.push("Agent confidence is low — verify against owner manual.");
  }
  if (response.intent === "visual_diagnosis") {
    limitations.push("Visual inference cannot confirm hidden causes or repairs.");
  }

  const blockers = [...safetyBlockers];
  for (const issue of [...outOfScopeIssues, ...inventedSettingsIssues]) {
    if (!blockers.includes(issue)) blockers.push(issue);
  }
  const warnings = [...safetyWarnings, ...contradictions.filter((c) => !blockers.includes(c))];

  const status = determineStatus({
    blockers,
    conflicts: contradictions,
    missing,
    coverage,
    hasClarifyingQuestion: !!response.clarifyingQuestion,
    confidence: response.confidence,
    machineClaimsUnsupported,
  });

  const howReached = buildHowReached(input, contradictions, limitations);

  const statusMessage = buildStatusMessage(status, blockers, contradictions, missing);

  return {
    status,
    coverage,
    howReached,
    blockers,
    warnings,
    claims,
    statusMessage,
    allowedToShow: status !== "blocked_for_safety",
    citations: response.citations,
  };
}

function buildStatusMessage(
  status: GroundingStatus,
  blockers: string[],
  conflicts: string[],
  missing: string[],
): string {
  const label = STATUS_LABELS[status];
  if (status === "blocked_for_safety" && blockers[0]) {
    return `${label}: ${blockers[0]}`;
  }
  if (status === "conflicting_sources" && conflicts[0]) {
    return `${label}: ${conflicts[0]}`;
  }
  if (status === "clarification_required" && missing[0]) {
    return `${label}: ${missing[0]}`;
  }
  if (status === "insufficient_manual_evidence") {
    return `${label} — some machine-specific claims are not cited in the manual.`;
  }
  return label;
}
