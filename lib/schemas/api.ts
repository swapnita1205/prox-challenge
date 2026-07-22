import { z } from "zod";
import { ArtifactSpecSchema } from "@/lib/schemas/artifacts";
import { CitationSchema } from "@/lib/schemas/conversation";
import { GroundingResultSchema } from "@/lib/grounding/schemas";
import { AnalyzeImageContextSchema } from "@/lib/vision/schemas";

export const ChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  mode: z.enum(["setup", "diagnose", "settings", "manual"]),
  message: z.string().min(1).max(8000),
  machineState: z.record(z.unknown()).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text_delta"),
    delta: z.string(),
  }),
  z.object({
    type: z.literal("progress"),
    /** Transient execution-status line, e.g. "Searching the owner manual".
     * Rendered in a dedicated status component — never appended to the
     * final assistant message text. */
    message: z.string(),
    icon: z.enum(["search", "found", "reasoning", "artifact"]),
    /** Present when icon is "artifact" — lets the UI show a type-specific
     * loading heading (e.g. "Preparing interactive calculator…") in the
     * artifact workspace while streaming. */
    artifactType: z.string().optional(),
  }),
  z.object({
    type: z.literal("artifact"),
    artifact: z.object({
      id: z.string(),
      spec: ArtifactSpecSchema,
    }),
  }),
  z.object({
    type: z.literal("evidence"),
    citations: z.array(CitationSchema),
  }),
  z.object({
    type: z.literal("grounding"),
    grounding: GroundingResultSchema,
  }),
  z.object({
    type: z.literal("state_update"),
    machineState: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal("done"),
    messageId: z.string(),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const AnalyzeImageRequestSchema = z.object({
  conversationId: z.string().min(1),
  sessionId: z.string().optional(),
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  context: AnalyzeImageContextSchema.optional(),
  mock: z.boolean().optional(),
});

export type AnalyzeImageRequest = z.infer<typeof AnalyzeImageRequestSchema>;

export const AnalyzeImageResponseSchema = z.object({
  analysis: z.record(z.unknown()),
  imageId: z.string(),
  artifactId: z.string(),
  artifact: ArtifactSpecSchema,
  detectiveSessionId: z.string().optional(),
  mock: z.boolean().optional(),
});
