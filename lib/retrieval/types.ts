import { z } from "zod";

export const CorpusTypeSchema = z.enum([
  "text_section",
  "table",
  "figure",
  "warning",
  "troubleshooting",
  "polarity",
  "settings",
  "duty_cycle",
  "graph_relationship",
  "direct_fact",
]);

export type CorpusType = z.infer<typeof CorpusTypeSchema>;

export const RetrievalMetadataSchema = z.object({
  source: z.string(),
  page: z.number(),
  section: z.string().optional(),
  processes: z.array(z.string()).default([]),
  inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
  outputAmps: z.number().optional(),
  material: z.string().optional(),
  thickness: z.string().optional(),
  wireType: z.string().optional(),
  wireDiameter: z.string().optional(),
  shieldingGas: z.string().optional(),
  polarity: z.string().optional(),
  symptom: z.string().optional(),
  component: z.string().optional(),
  safetyRelevant: z.boolean().optional(),
  verified: z.boolean().default(false),
  assetPath: z.string().optional(),
  assetId: z.string().optional(),
});

export type RetrievalMetadata = z.infer<typeof RetrievalMetadataSchema>;

export const FormattedCitationSchema = z.object({
  id: z.string(),
  source: z.string(),
  page: z.number(),
  section: z.string().optional(),
  assetId: z.string().optional(),
  assetPath: z.string().optional(),
  excerpt: z.string().optional(),
  confidence: z.number().optional(),
  verified: z.boolean().optional(),
});

export type FormattedCitation = z.infer<typeof FormattedCitationSchema>;

export const RetrievedItemSchema = z.object({
  id: z.string(),
  corpusType: CorpusTypeSchema,
  score: z.number(),
  title: z.string().optional(),
  text: z.string(),
  metadata: RetrievalMetadataSchema,
  citation: FormattedCitationSchema,
  payload: z.unknown().optional(),
});

export type RetrievedItem = z.infer<typeof RetrievedItemSchema>;

export const RetrievalTaskSchema = z.object({
  id: z.string(),
  intent: z.string(),
  expandedQuery: z.string(),
  corpusTypes: z.array(CorpusTypeSchema).optional(),
  dimensions: RetrievalMetadataSchema.partial().optional(),
});

export type RetrievalTask = z.infer<typeof RetrievalTaskSchema>;

export const QueryDimensionsSchema = z.object({
  processes: z.array(z.string()).default([]),
  inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
  outputAmps: z.number().optional(),
  material: z.string().optional(),
  thickness: z.string().optional(),
  wireType: z.string().optional(),
  wireDiameter: z.string().optional(),
  shieldingGas: z.string().optional(),
  polarity: z.string().optional(),
  symptom: z.string().optional(),
  component: z.string().optional(),
  safetyRelevant: z.boolean().optional(),
  intents: z.array(z.string()).default([]),
});

export type QueryDimensions = z.infer<typeof QueryDimensionsSchema>;

export const AmbiguitySchema = z.object({
  kind: z.enum([
    "missing_process",
    "missing_voltage",
    "multiple_processes",
    "ambiguous_symptom",
    "unverified_data",
    "multimodal_required",
  ]),
  message: z.string(),
  suggestions: z.array(z.string()).optional(),
});

export type Ambiguity = z.infer<typeof AmbiguitySchema>;

export const ConflictingEvidenceSchema = z.object({
  topic: z.string(),
  items: z.array(FormattedCitationSchema),
  message: z.string(),
});

export type ConflictingEvidence = z.infer<typeof ConflictingEvidenceSchema>;

export const RetrievalBundleSchema = z.object({
  query: z.string(),
  decomposedTasks: z.array(RetrievalTaskSchema),
  dimensions: QueryDimensionsSchema,
  directFacts: z.array(RetrievedItemSchema),
  supportingSections: z.array(RetrievedItemSchema),
  tables: z.array(RetrievedItemSchema),
  figures: z.array(RetrievedItemSchema),
  warnings: z.array(RetrievedItemSchema),
  graphRelationships: z.array(RetrievedItemSchema),
  ambiguities: z.array(AmbiguitySchema),
  conflictingEvidence: z.array(ConflictingEvidenceSchema),
  citations: z.array(FormattedCitationSchema),
});

export type RetrievalBundle = z.infer<typeof RetrievalBundleSchema>;

export interface CorpusDocument {
  id: string;
  corpusType: CorpusType;
  title?: string;
  text: string;
  metadata: RetrievalMetadata;
  payload?: unknown;
}
