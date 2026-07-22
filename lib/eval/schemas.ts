import { z } from "zod";

export const EvalCategorySchema = z.enum([
  "technical_factual",
  "cross_page",
  "duty_cycle",
  "polarity",
  "machine_setup",
  "wire_feed",
  "troubleshooting",
  "ambiguous",
  "visual_content",
  "unsafe",
  "out_of_scope",
  "settings",
  "multi_turn_diagnosis",
]);

export type EvalCategory = z.infer<typeof EvalCategorySchema>;

export const AcceptedCitationSchema = z.object({
  source: z.string().optional(),
  page: z.number(),
  section: z.string().optional(),
});

export const ExpectedToolCallSchema = z.object({
  tool: z.string(),
  input: z.record(z.unknown()).optional(),
  outputPatterns: z.array(z.string()).optional(),
});

export const DetectivePathSchema = z.object({
  complaint: z.string(),
  turns: z
    .array(
      z.object({
        questionId: z.string(),
        answer: z.string(),
      }),
    )
    .optional(),
  expectedFirstQuestionId: z.string().optional(),
  expectedTopFaultPattern: z.string().optional(),
  minPlausibleCauses: z.number().optional(),
  maxInitialConfidence: z.number().optional(),
});

export const RetrievalExpectationsSchema = z.object({
  minItems: z.number().optional(),
  corpusTypes: z.array(z.string()).optional(),
  sourcePages: z.array(AcceptedCitationSchema).optional(),
  textPatterns: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  minAmbiguities: z.number().optional(),
  ambiguityKinds: z.array(z.string()).optional(),
});

export const EvalCaseSchema = z.object({
  id: z.string(),
  category: EvalCategorySchema,
  question: z.string(),
  description: z.string().optional(),
  mode: z.enum(["setup", "diagnose", "settings", "manual"]).optional(),
  requiredFacts: z.array(z.string()).optional(),
  acceptedCitations: z.array(AcceptedCitationSchema).optional(),
  expectedArtifactTypes: z.array(z.string()).optional(),
  clarificationRequired: z.boolean().optional(),
  prohibitedClaims: z.array(z.string()).optional(),
  safetyRequirements: z.array(z.string()).optional(),
  expectedToolCalls: z.array(ExpectedToolCallSchema).optional(),
  detectivePath: DetectivePathSchema.optional(),
  retrievalExpectations: RetrievalExpectationsSchema.optional(),
  groundingIntent: z
    .enum([
      "setup",
      "troubleshooting",
      "settings",
      "calculation",
      "part_identification",
      "manual_question",
      "visual_diagnosis",
      "safety_critical",
    ])
    .optional(),
  syntheticAnswer: z.string().optional(),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;

export interface EvalCaseResult {
  id: string;
  category: EvalCategory;
  question: string;
  passed: boolean;
  score: number;
  metrics: {
    citationCorrectness: number;
    factualCoverage: number;
    unsupportedClaimRate: number;
    artifactSelection: number;
    clarificationQuality: number;
    safetyCompliance: number;
    retrievalRecall: number;
    diagnosticRanking: number;
    responseLatencyMs: number | null;
    approximateApiCostUsd: number | null;
  };
  failures: string[];
  warnings: string[];
  citationsFound: Array<{ source: string; page: number }>;
  artifactsFound: string[];
  groundingStatus: string | null;
  toolResults: Array<{ tool: string; ok: boolean; detail?: string }>;
  retrievalScore: number | null;
  detectiveTopHypothesis: string | null;
}

export interface EvalSummary {
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  averageScore: number;
  byCategory: Record<
    string,
    { total: number; passed: number; passRate: number; averageScore: number }
  >;
  aggregateMetrics: {
    citationCorrectness: number;
    factualCoverage: number;
    unsupportedClaimRate: number;
    artifactSelection: number;
    clarificationQuality: number;
    safetyCompliance: number;
    retrievalRecall: number;
    diagnosticRanking: number;
    responseLatencyMs: number | null;
    approximateApiCostUsd: number | null;
  };
}

export interface EvalReport {
  generatedAt: string;
  mode: "deterministic" | "live";
  corpusStats: { total: number; byType: Record<string, number> };
  summary: EvalSummary;
  cases: EvalCaseResult[];
  failedCases: EvalCaseResult[];
  toolRegression: {
    total: number;
    passed: number;
    failed: number;
    cases: Array<{ id: string; tool: string; passed: boolean; failures: string[] }>;
  };
  liveAgent: {
    enabled: boolean;
    casesRun: number;
    totalLatencyMs: number;
    totalCostUsd: number;
  };
}

export interface ToolRegressionCase {
  id: string;
  tool: string;
  description: string;
  input: Record<string, unknown>;
  outputPatterns: string[];
  expectCitations?: Array<{ page: number }>;
  expectArtifactType?: string;
}
