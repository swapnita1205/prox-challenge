import { z } from "zod";
import { CitationSchema } from "@/lib/schemas/conversation";
import { ProcessSchema } from "@/lib/schemas/conversation";

export const VISIBLE_DEFECT_CATEGORY_SCHEMA = z.enum([
  "porosity",
  "excessive_spatter",
  "burn_through",
  "inadequate_penetration",
  "excess_penetration",
  "crooked_wavy_bead",
  "slag_inclusion",
  "undercut",
  "arc_strikes",
  "uncertain",
]);

export type VisibleDefectCategory = z.infer<typeof VISIBLE_DEFECT_CATEGORY_SCHEMA>;

export const VisionConfidenceSchema = z.enum(["high", "medium", "low"]);
export type VisionConfidence = z.infer<typeof VisionConfidenceSchema>;

export const NormalizedRegionSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(0).max(100),
  height: z.number().min(0).max(100),
  description: z.string().optional(),
});

export type NormalizedRegion = z.infer<typeof NormalizedRegionSchema>;

export const VisionCalloutSchema = z.object({
  id: z.string(),
  label: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  targetRegionId: z.string().optional(),
});

export const WeldPhotoAnalysisSchema = z.object({
  possibleDefectCategories: z.array(VISIBLE_DEFECT_CATEGORY_SCHEMA).min(1),
  visualObservations: z.array(z.string()).min(1),
  confidence: VisionConfidenceSchema,
  uncertaintyNotes: z.array(z.string()).default([]),
  potentialCauses: z.array(
    z.object({
      cause: z.string(),
      groundedInManual: z.boolean(),
      citation: CitationSchema.optional(),
    }),
  ),
  recommendedNextStep: z.string(),
  matchedManualFigure: z.object({
    assetId: z.string(),
    source: z.string(),
    page: z.number(),
    label: z.string(),
    section: z.string().optional(),
    matchScore: z.number().min(0).max(1),
  }),
  alternateFigures: z
    .array(
      z.object({
        assetId: z.string(),
        source: z.string(),
        page: z.number(),
        label: z.string(),
        matchScore: z.number().min(0).max(1),
      }),
    )
    .default([]),
  regions: z.array(NormalizedRegionSchema).default([]),
  callouts: z.array(VisionCalloutSchema).default([]),
  disclaimer: z.string(),
  repairConfirmed: z.literal(false),
});

export type WeldPhotoAnalysis = z.infer<typeof WeldPhotoAnalysisSchema>;

export const AnalyzeImageContextSchema = z.object({
  process: ProcessSchema.optional(),
  inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
  polarity: z.string().optional(),
  gas: z.string().optional(),
  material: z.string().optional(),
  userNotes: z.string().optional(),
});

export type AnalyzeImageContext = z.infer<typeof AnalyzeImageContextSchema>;

export const AnalyzeImageResponseSchema = z.object({
  analysis: WeldPhotoAnalysisSchema,
  imageId: z.string(),
  artifactId: z.string(),
  detectiveSessionId: z.string().optional(),
  mock: z.boolean().optional(),
});

export type AnalyzeImageResponse = z.infer<typeof AnalyzeImageResponseSchema>;
