import { z } from "zod";

export const WeldModeSchema = z.enum([
  "setup",
  "diagnose",
  "settings",
  "manual",
]);

export type WeldMode = z.infer<typeof WeldModeSchema>;

export const WELD_MODES: Record<
  WeldMode,
  { id: WeldMode; title: string; description: string; icon: string }
> = {
  setup: {
    id: "setup",
    title: "Setup My Welder",
    description:
      "Wire feed, polarity, gas, and spool setup with step-by-step visual guides.",
    icon: "wrench",
  },
  diagnose: {
    id: "diagnose",
    title: "Diagnose My Weld",
    description:
      "Describe weld defects or upload a photo for ranked troubleshooting hypotheses.",
    icon: "search",
  },
  settings: {
    id: "settings",
    title: "Find My Settings",
    description:
      "Get recommended voltage, wire speed, and gas settings for your job.",
    icon: "sliders",
  },
  manual: {
    id: "manual",
    title: "Ask the Manual",
    description:
      "Ask technical questions with page-level citations from the owner's manual.",
    icon: "book",
  },
};

export const ProcessSchema = z.enum(["mig", "flux", "tig", "stick"]);
export type Process = z.infer<typeof ProcessSchema>;

export const InputVoltageSchema = z.union([z.literal(120), z.literal(240)]);
export type InputVoltage = z.infer<typeof InputVoltageSchema>;

export const HypothesisSchema = z.object({
  id: z.string(),
  label: z.string(),
  posterior: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
  ruledOut: z.boolean().optional(),
});

export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const MachineStateSchema = z.object({
  mode: WeldModeSchema,
  process: ProcessSchema.optional(),
  inputVoltage: InputVoltageSchema.optional(),
  material: z.string().optional(),
  thickness: z.string().optional(),
  wireDiameter: z.string().optional(),
  gas: z.string().optional(),
  polarity: z.string().optional(),
  symptoms: z.array(z.string()).default([]),
  hypotheses: z.array(HypothesisSchema).default([]),
  askedQuestions: z.array(z.string()).default([]),
  safetyAcknowledged: z.boolean().default(false),
});

export type MachineState = z.infer<typeof MachineStateSchema>;

export const CitationSchema = z.object({
  source: z.string(),
  page: z.number(),
  section: z.string().optional(),
  excerpt: z.string().optional(),
  assetId: z.string().optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.number(),
  citations: z.array(CitationSchema).optional(),
  artifactId: z.string().optional(),
  status: z.enum(["pending", "streaming", "complete", "error"]).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  mode: WeldModeSchema,
  messages: z.array(ChatMessageSchema).default([]),
  machineState: MachineStateSchema,
  activeArtifactId: z.string().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Conversation = z.infer<typeof ConversationSchema>;
