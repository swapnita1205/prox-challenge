/**
 * Transient execution-progress labels shown in the UI's status component
 * while a request is being processed — never part of the final assistant
 * message text (see lib/agent/runner-core.ts and StreamEvent's "progress"
 * variant in lib/schemas/api.ts).
 */
import type { ArtifactSpec } from "@/lib/schemas/artifacts";

export type ProgressIcon = "search" | "found" | "reasoning" | "artifact";

export interface ProgressStep {
  message: string;
  icon: ProgressIcon;
  artifactType?: string;
}

/** Status shown while Claude is mid-turn and calls a tool live. */
export const PROGRESS_BY_TOOL: Record<string, ProgressStep> = {
  search_manual: { message: "Searching the owner manual", icon: "search" },
  get_manual_page: { message: "Loading manual page", icon: "search" },
  get_figure: { message: "Fetching diagram", icon: "found" },
  query_machine_graph: { message: "Checking the machine knowledge graph", icon: "search" },
  calculate_duty_cycle: { message: "Calculating duty cycle", icon: "reasoning" },
  validate_machine_configuration: { message: "Validating configuration", icon: "reasoning" },
  find_settings: { message: "Looking up the settings chart", icon: "search" },
  start_diagnostic_session: { message: "Starting diagnostic session", icon: "reasoning" },
  update_diagnostic_session: { message: "Updating diagnostic session", icon: "reasoning" },
  generate_artifact_spec: { message: "Preparing workspace artifact", icon: "artifact" },
  run_safety_review: { message: "Running safety review", icon: "reasoning" },
};

const ARTIFACT_PREPARING_LABEL: Partial<Record<ArtifactSpec["type"], string>> = {
  "duty-cycle-calculator": "Building interactive calculator",
  "settings-configurator": "Building settings configurator",
  "polarity-diagram": "Building polarity diagram",
  "cable-routing-diagram": "Building cable-routing diagram",
  "troubleshooting-flow": "Building troubleshooting flow",
  "diagnostic-hypothesis-board": "Building hypothesis board",
  "manual-figure": "Preparing manual diagram",
  "annotated-manual-figure": "Preparing annotated diagram",
  "component-map": "Building component map",
  "step-by-step-checklist": "Preparing setup checklist",
  "weld-defect-comparison": "Preparing defect comparison",
  "configuration-summary": "Preparing configuration summary",
};

/** Progress step announcing that a specific artifact is being built. */
export function artifactProgressStep(spec: Pick<ArtifactSpec, "type">): ProgressStep {
  const message = ARTIFACT_PREPARING_LABEL[spec.type] ?? "Preparing interactive artifact";
  return { message, icon: "artifact", artifactType: spec.type };
}

const ARTIFACT_LOADING_HEADING: Partial<Record<ArtifactSpec["type"], string>> = {
  "duty-cycle-calculator": "Preparing interactive calculator…",
  "settings-configurator": "Preparing settings configurator…",
  "polarity-diagram": "Preparing diagram…",
  "cable-routing-diagram": "Preparing diagram…",
  "troubleshooting-flow": "Preparing troubleshooting flow…",
  "diagnostic-hypothesis-board": "Preparing hypothesis board…",
  "manual-figure": "Preparing diagram…",
  "annotated-manual-figure": "Preparing diagram…",
  "component-map": "Preparing component map…",
  "step-by-step-checklist": "Preparing checklist…",
  "weld-defect-comparison": "Preparing comparison…",
  "configuration-summary": "Preparing summary…",
};

/** Heading shown in the artifact workspace skeleton while streaming. Falls
 * back to a generic label when the eventual artifact type is not yet known. */
export function artifactLoadingHeading(type?: string | null): string {
  if (type && type in ARTIFACT_LOADING_HEADING) {
    return ARTIFACT_LOADING_HEADING[type as ArtifactSpec["type"]]!;
  }
  return "Preparing interactive artifact…";
}
