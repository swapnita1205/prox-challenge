import { z } from "zod";
import { CitationSchema } from "@/lib/schemas/conversation";

export const GarageStepSchema = z.object({
  id: z.string(),
  shortLabel: z.string(),
  speakText: z.string(),
  safetyCritical: z.boolean().optional(),
  citation: CitationSchema.optional(),
});

export type GarageStep = z.infer<typeof GarageStepSchema>;

export const GarageProcedureSchema = z.object({
  id: z.string(),
  title: z.string(),
  steps: z.array(GarageStepSchema).min(1),
  citations: z.array(CitationSchema).default([]),
});

export type GarageProcedure = z.infer<typeof GarageProcedureSchema>;

export interface VoiceCapabilities {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  speechRecognitionReason?: string;
  speechSynthesisReason?: string;
}

export interface GarageModeState {
  active: boolean;
  procedure: GarageProcedure | null;
  stepIndex: number;
  completedStepIds: string[];
  voiceEnabled: boolean;
}
