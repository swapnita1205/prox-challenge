import { z } from "zod";
import { CitationSchema } from "@/lib/schemas/conversation";

export const GroundingStatusSchema = z.enum([
  "grounded",
  "grounded_with_uncertainty",
  "clarification_required",
  "conflicting_sources",
  "insufficient_manual_evidence",
  "blocked_for_safety",
]);

export type GroundingStatus = z.infer<typeof GroundingStatusSchema>;

export const ClaimKindSchema = z.enum([
  "numeric",
  "machine",
  "procedural",
  "visual",
  "configuration",
]);

export type ClaimKind = z.infer<typeof ClaimKindSchema>;

export const EvidenceLevelSchema = z.enum([
  "direct",
  "indirect",
  "calculated",
  "unsupported",
]);

export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

export const ExtractedClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: ClaimKindSchema,
  evidenceLevel: EvidenceLevelSchema,
  citationKey: z.string().optional(),
});

export type ExtractedClaim = z.infer<typeof ExtractedClaimSchema>;

export const EvidenceCoverageSchema = z.object({
  claimsMade: z.number(),
  directEvidence: z.number(),
  indirectEvidence: z.number(),
  calculatedEvidence: z.number(),
  unsupportedClaims: z.number(),
  coverageScore: z.number().min(0).max(1),
});

export type EvidenceCoverage = z.infer<typeof EvidenceCoverageSchema>;

export const HowReachedPanelSchema = z.object({
  manualFactsUsed: z.array(z.string()).default([]),
  userObservations: z.array(z.string()).default([]),
  hypothesesConsidered: z.array(z.string()).default([]),
  contradictionsFound: z.array(z.string()).default([]),
  reasonForNextQuestion: z.string().optional(),
  confidenceLimitations: z.array(z.string()).default([]),
});

export type HowReachedPanel = z.infer<typeof HowReachedPanelSchema>;

export const GroundingResultSchema = z.object({
  status: GroundingStatusSchema,
  coverage: EvidenceCoverageSchema,
  howReached: HowReachedPanelSchema,
  blockers: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  claims: z.array(ExtractedClaimSchema).default([]),
  statusMessage: z.string(),
  allowedToShow: z.boolean(),
  citations: z.array(CitationSchema).default([]),
});

export type GroundingResult = z.infer<typeof GroundingResultSchema>;

export const STATUS_LABELS: Record<GroundingStatus, string> = {
  grounded: "Grounded in manual evidence",
  grounded_with_uncertainty: "Grounded with uncertainty",
  clarification_required: "One more detail needed",
  conflicting_sources: "Conflicting manual sources",
  insufficient_manual_evidence: "Insufficient manual evidence",
  blocked_for_safety: "Blocked for safety",
};
