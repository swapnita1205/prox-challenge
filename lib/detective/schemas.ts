import { z } from "zod";
import { CitationSchema } from "@/lib/schemas/conversation";

export const ObservationSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(["user", "inferred", "manual"]).default("user"),
  supportsFaultIds: z.array(z.string()).default([]),
  contradictsFaultIds: z.array(z.string()).default([]),
  timestamp: z.number(),
});

export type Observation = z.infer<typeof ObservationSchema>;

export const MachineConfigurationSnapshotSchema = z.object({
  process: z.enum(["mig", "flux", "tig", "stick"]).optional(),
  wireType: z.enum(["solid", "flux-self", "flux-gas", "unknown"]).optional(),
  inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
  polarity: z.enum(["DCEP", "DCEN", "unknown"]).optional(),
  gasShielded: z.boolean().optional(),
  material: z.string().optional(),
});

export type MachineConfigurationSnapshot = z.infer<typeof MachineConfigurationSnapshotSchema>;

export const CandidateFaultSchema = z.object({
  id: z.string(),
  faultId: z.string(),
  label: z.string(),
  score: z.number().min(0).max(1),
  supportEvidence: z.array(CitationSchema).default([]),
  contradictEvidence: z.array(z.string()).default([]),
  eliminated: z.boolean().default(false),
  compatibleProcesses: z.array(z.string()).default([]),
  manualRelevance: z.number().min(0).max(1),
  inspectionCost: z.enum(["low", "medium", "high"]).default("medium"),
});

export type CandidateFault = z.infer<typeof CandidateFaultSchema>;

export const AskedQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  rationale: z.string(),
  askedAt: z.number(),
  answer: z.string().optional(),
  skipped: z.boolean().optional(),
});

export type AskedQuestion = z.infer<typeof AskedQuestionSchema>;

export const DiagnosticQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  rationale: z.string(),
  expectedInfoGain: z.number(),
  effort: z.enum(["low", "medium", "high"]),
  safetyRisk: z.enum(["low", "medium", "high"]),
  separatesFaultCount: z.number(),
});

export type DiagnosticQuestion = z.infer<typeof DiagnosticQuestionSchema>;

export const SafetyStateSchema = z.object({
  acknowledged: z.boolean().default(false),
  warnings: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
});

export type SafetyState = z.infer<typeof SafetyStateSchema>;

export const FinalResolutionSchema = z.object({
  summary: z.string(),
  primaryFaultId: z.string().optional(),
  recommendedActions: z.array(z.string()).default([]),
  citations: z.array(CitationSchema).default([]),
});

export type FinalResolution = z.infer<typeof FinalResolutionSchema>;

export const DiagnosticSessionSchema = z.object({
  id: z.string(),
  originalComplaint: z.string(),
  machineConfiguration: MachineConfigurationSnapshotSchema.default({}),
  observations: z.array(ObservationSchema).default([]),
  candidateFaults: z.array(CandidateFaultSchema).default([]),
  eliminatedFaultIds: z.array(z.string()).default([]),
  uncertainty: z.number().min(0).max(1),
  questionsAsked: z.array(AskedQuestionSchema).default([]),
  actionsAttempted: z.array(z.string()).default([]),
  safetyState: SafetyStateSchema.default({ acknowledged: false, warnings: [], blockers: [] }),
  finalResolution: FinalResolutionSchema.optional(),
  currentQuestion: DiagnosticQuestionSchema.nullable().optional(),
  diagnosticConfidence: z.number().min(0).max(1),
  plausibleCauseCount: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type DiagnosticSession = z.infer<typeof DiagnosticSessionSchema>;

export const DetectiveSnapshotSchema = z.object({
  session: DiagnosticSessionSchema,
  rankedHypotheses: z.array(CandidateFaultSchema),
  eliminatedFaults: z.array(CandidateFaultSchema),
  whyThisQuestion: z.string().optional(),
});

export type DetectiveSnapshot = z.infer<typeof DetectiveSnapshotSchema>;
