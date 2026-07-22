import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import { normalizeArtifactSpec } from "@/lib/artifacts/normalize";

export { normalizeArtifactSpec };

export function validateArtifactSpec(spec: unknown): ArtifactSpec | null {
  return normalizeArtifactSpec(spec);
}

export function getArtifactTitle(spec: ArtifactSpec): string {
  if (spec.type === "placeholder") return spec.title;
  return spec.title;
}

export const ARTIFACT_TYPE_LABELS: Record<ArtifactSpec["type"], string> = {
  "polarity-diagram": "Polarity Diagram",
  "cable-routing-diagram": "Cable Routing",
  "duty-cycle-calculator": "Duty Cycle Calculator",
  "settings-configurator": "Settings Configurator",
  "troubleshooting-flow": "Troubleshooting Flow",
  "diagnostic-hypothesis-board": "Hypothesis Board",
  "manual-figure": "Manual Figure",
  "annotated-manual-figure": "Annotated Figure",
  "component-map": "Component Map",
  "step-by-step-checklist": "Setup Checklist",
  "weld-defect-comparison": "Defect Comparison",
  "configuration-summary": "Configuration Summary",
  placeholder: "Placeholder",
};
