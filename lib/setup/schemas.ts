import { z } from "zod";
import type { Process } from "@/lib/schemas/conversation";
import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";

export const SetupProcessSchema = z.enum(["mig-solid", "flux", "tig", "stick"]);
export type SetupProcess = z.infer<typeof SetupProcessSchema>;

export const ShieldingOptionSchema = z.enum(["none", "c25", "100-argon", "dual-shield", "other"]);
export type ShieldingOption = z.infer<typeof ShieldingOptionSchema>;

export const SetupInputsSchema = z.object({
  process: SetupProcessSchema.optional(),
  inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
  material: z.string().optional(),
  thickness: z.string().optional(),
  consumable: z.string().optional(),
  wireDiameter: z.string().optional(),
  shielding: ShieldingOptionSchema.optional(),
  gasShieldedFlux: z.boolean().optional(),
  spoolGun: z.boolean().optional(),
  optionalNotes: z.string().optional(),
});

export type SetupInputs = z.infer<typeof SetupInputsSchema>;

export const SetupValidationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  citation: z
    .object({
      source: z.string(),
      page: z.number(),
      section: z.string().optional(),
    })
    .optional(),
});

export type SetupValidationIssue = z.infer<typeof SetupValidationIssueSchema>;

export const SetupPackSchema = z.object({
  artifacts: z.array(z.custom<ArtifactSpec>()),
  citations: z.array(
    z.object({
      source: z.string(),
      page: z.number(),
      section: z.string().optional(),
      excerpt: z.string().optional(),
    }),
  ),
  validation: z.object({
    valid: z.boolean(),
    status: z.enum(["verified", "partial", "unverified", "invalid"]),
    issues: z.array(SetupValidationIssueSchema),
  }),
  askPrompt: z.string(),
  processLabel: z.string().optional(),
});

export type SetupPack = z.infer<typeof SetupPackSchema>;

export const WIZARD_STEPS = [
  "process",
  "voltage",
  "material",
  "thickness",
  "consumable",
  "wire",
  "shielding",
  "optional",
  "review",
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export function processToGraphId(process: SetupProcess): string {
  const map: Record<SetupProcess, string> = {
    "mig-solid": "process-mig-solid",
    flux: "process-flux",
    tig: "process-tig",
    stick: "process-stick",
  };
  return map[process];
}

export function processToSlug(process: SetupProcess): Process {
  if (process === "mig-solid") return "mig";
  return process;
}
