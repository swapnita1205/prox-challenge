import { z } from "zod";
import { ArtifactSpecSchema } from "@/lib/schemas/artifacts";
import { CitationSchema, HypothesisSchema } from "@/lib/schemas/conversation";

export const AgentIntentSchema = z.enum([
  "setup",
  "troubleshooting",
  "settings",
  "calculation",
  "part_identification",
  "manual_question",
  "visual_diagnosis",
  "safety_critical",
]);

export type AgentIntent = z.infer<typeof AgentIntentSchema>;

export const AgentConfidenceSchema = z.enum(["high", "medium", "low"]);
export type AgentConfidence = z.infer<typeof AgentConfidenceSchema>;

export const DiagnosticStateSchema = z.object({
  sessionId: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  hypotheses: z.array(HypothesisSchema).default([]),
  askedQuestions: z.array(z.string()).default([]),
  ruledOutFaultIds: z.array(z.string()).default([]),
  evidenceSummary: z.string().optional(),
  questionRationale: z.string().optional(),
});

export type DiagnosticState = z.infer<typeof DiagnosticStateSchema>;

export const AgentResponseSchema = z.object({
  intent: AgentIntentSchema,
  answer: z.string().min(1),
  clarifyingQuestion: z.string().nullable().optional(),
  artifact: ArtifactSpecSchema.nullable().optional(),
  citations: z.array(CitationSchema).default([]),
  safetyNotices: z.array(z.string()).default([]),
  confidence: AgentConfidenceSchema.default("medium"),
  suggestedActions: z.array(z.string()).default([]),
  diagnosticState: DiagnosticStateSchema.nullable().optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const AGENT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "intent",
    "answer",
    "citations",
    "safetyNotices",
    "confidence",
    "suggestedActions",
  ],
  properties: {
    intent: {
      type: "string",
      enum: [
        "setup",
        "troubleshooting",
        "settings",
        "calculation",
        "part_identification",
        "manual_question",
        "visual_diagnosis",
        "safety_critical",
      ],
    },
    answer: { type: "string" },
    clarifyingQuestion: { type: ["string", "null"] },
    artifact: { type: ["object", "null"] },
    citations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          page: { type: "number" },
          section: { type: "string" },
          excerpt: { type: "string" },
          assetId: { type: "string" },
        },
        required: ["source", "page"],
      },
    },
    safetyNotices: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    suggestedActions: { type: "array", items: { type: "string" } },
    diagnosticState: { type: ["object", "null"] },
  },
} as const;
