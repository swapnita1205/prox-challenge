import type { DiagnosticSession } from "@/lib/detective/schemas";
import type { DiagnosticHypothesisBoardArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";

type HypothesisBoardSpec = z.infer<typeof DiagnosticHypothesisBoardArtifactSchema>;

export function sessionToHypothesisArtifact(session: DiagnosticSession): HypothesisBoardSpec {
  const citations = session.candidateFaults
    .flatMap((f) => f.supportEvidence)
    .slice(0, 5);

  const confidenceLevel =
    session.diagnosticConfidence >= 0.7
      ? "high"
      : session.diagnosticConfidence >= 0.4
        ? "medium"
        : "low";

  let evidenceSummary = `Diagnostic confidence: ${Math.round(session.diagnosticConfidence * 100)}%. ${session.plausibleCauseCount} plausible cause(s) remain.`;
  if (session.currentQuestion) {
    evidenceSummary += ` Next check: ${session.currentQuestion.text}`;
  } else if (session.finalResolution) {
    evidenceSummary = session.finalResolution.summary;
  }

  return {
    type: "diagnostic-hypothesis-board",
    title: "Machine Detective",
    description: session.originalComplaint,
    citations,
    confidence: confidenceLevel,
    safetyNotice: session.safetyState.warnings[0],
    hypotheses: session.candidateFaults.map((f) => ({
      id: f.id,
      label: f.label,
      confidence: f.score,
      evidenceFor: f.supportEvidence.map(
        (e) => `${e.source} p.${e.page}${e.section ? ` (${e.section})` : ""}`,
      ),
      evidenceAgainst: f.contradictEvidence,
      ruledOut: f.eliminated,
      missingObservation: f.eliminated
        ? undefined
        : session.currentQuestion?.id === "contamination" && /dirty/i.test(f.label)
          ? "Confirm surface cleanliness"
          : undefined,
    })),
    evidenceSummary,
  };
}
