import { z } from "zod";
import type { Citation } from "@/lib/schemas/conversation";

export const SettingsProcessSchema = z.enum(["mig", "flux", "tig", "stick"]);
export type SettingsProcess = z.infer<typeof SettingsProcessSchema>;

export const RecommendationStatusSchema = z.enum([
  "resolved",
  "multimodal_required",
  "partial",
  "unsupported",
  "conflicting",
]);
export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;

export const SettingsSourceRecordSchema = z.object({
  id: z.string(),
  source: z.string(),
  page: z.number(),
  section: z.string().optional(),
  excerpt: z.string().optional(),
  assetPath: z.string().optional(),
  recordType: z.enum(["selection_chart", "specification", "setup_procedure"]),
});

export type SettingsSourceRecord = z.infer<typeof SettingsSourceRecordSchema>;

export const SettingsResolutionSchema = z.object({
  process: SettingsProcessSchema.optional(),
  material: z.string().optional(),
  thickness: z.string().optional(),
  thicknessNormalized: z
    .object({
      label: z.string(),
      original: z.string(),
      inches: z.number(),
      millimeters: z.number(),
    })
    .optional(),
  inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
  wireType: z.string().optional(),
  wireDiameter: z.string().optional(),
  shieldingGas: z.string().optional(),
  polarity: z.string().optional(),
  voltageSetting: z.string().optional(),
  wireFeedSetting: z.string().optional(),
  amperageSetting: z.string().optional(),
  sourceRecords: z.array(SettingsSourceRecordSchema),
  missingRequiredParameters: z.array(z.string()),
  conflicts: z.array(z.string()),
  recommendationStatus: RecommendationStatusSchema,
  clarifyingQuestion: z.string().optional(),
  naturalLanguageAnswer: z.string(),
  citations: z.array(
    z.object({
      source: z.string(),
      page: z.number(),
      section: z.string().optional(),
      excerpt: z.string().optional(),
    }),
  ),
});

export type SettingsResolution = z.infer<typeof SettingsResolutionSchema>;

export interface SettingsLookupInput {
  query?: string;
  process?: string;
  material?: string;
  thickness?: string;
  inputVoltage?: 120 | 240;
  wireType?: string;
  wireDiameter?: string;
  shieldingGas?: string;
}

export function resolutionToCitations(resolution: SettingsResolution): Citation[] {
  return resolution.citations.map((c) => ({
    source: c.source,
    page: c.page,
    section: c.section,
    excerpt: c.excerpt,
  }));
}
