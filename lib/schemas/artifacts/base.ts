import { z } from "zod";
import { CitationSchema } from "@/lib/schemas/conversation";

export const ArtifactConfidenceSchema = z.enum(["high", "medium", "low"]);

export const ArtifactProvenanceSchema = z.object({
  source: z.string(),
  verified: z.boolean().optional(),
  extractionMethod: z.string().optional(),
  assetId: z.string().optional(),
});

export const ArtifactMetaSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  citations: z.array(CitationSchema).default([]),
  safetyNotice: z.string().optional(),
  confidence: ArtifactConfidenceSchema.optional(),
  provenance: ArtifactProvenanceSchema.optional(),
});

export type ArtifactMeta = z.infer<typeof ArtifactMetaSchema>;

export const ProcessSlugSchema = z.enum(["mig-solid", "mig", "flux", "tig", "stick"]);
export const SocketPolaritySchema = z.enum(["positive", "negative", "workpiece", "torch"]);
