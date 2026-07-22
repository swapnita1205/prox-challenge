import type { SetupInputs } from "@/lib/setup/schemas";
import type { WeldMode } from "@/lib/schemas/conversation";
import type { AnalyzeImageContext } from "@/lib/vision/schemas";

export type DemoScenarioId =
  | "duty-cycle"
  | "tig-setup"
  | "flux-porosity"
  | "settings-configurator"
  | "visual-diagnosis";

export type DemoActionKind =
  | "chat"
  | "setup-pack-then-chat"
  | "settings-pack"
  | "visual-analysis";

export interface DemoScenario {
  id: DemoScenarioId;
  title: string;
  subtitle: string;
  mode: WeldMode;
  prompt: string;
  durationMinutes: number;
  criteriaTags: string[];
  expectedHighlights: string[];
  action: DemoActionKind;
  setupInputs?: SetupInputs;
  visionContext?: AnalyzeImageContext;
  sampleImagePath?: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "duty-cycle",
    title: "Duty Cycle",
    subtitle: "Exact cited specs + interactive calculator",
    mode: "manual",
    prompt: "What's the duty cycle for MIG welding at 200A on 240V?",
    durationMinutes: 0.75,
    criteriaTags: ["Technical accuracy", "Deterministic calculators", "Manual citations"],
    expectedHighlights: [
      "Exact cited answer from owner-manual.pdf p.7",
      "Interactive duty-cycle calculator artifact",
      "10-minute work/cool timeline",
      "Table evidence in citations drawer",
    ],
    action: "chat",
  },
  {
    id: "tig-setup",
    title: "TIG Setup",
    subtitle: "Polarity, sockets, and cable routing",
    mode: "setup",
    prompt:
      "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?",
    durationMinutes: 0.75,
    criteriaTags: ["Multimodal responses", "Setup guidance", "Visual diagrams"],
    expectedHighlights: [
      "Cable routing diagram (ground → positive socket)",
      "Manual figure from owner-manual.pdf p.24",
      "Step-by-step setup checklist",
      "Clarification only when genuinely needed",
    ],
    action: "setup-pack-then-chat",
    setupInputs: {
      process: "tig",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "ER70S-2 filler",
      shielding: "100-argon",
    },
  },
  {
    id: "flux-porosity",
    title: "Flux-Core Porosity",
    subtitle: "Machine Detective structured diagnosis",
    mode: "diagnose",
    prompt: "I'm getting porosity in my flux-cored welds. What should I check?",
    durationMinutes: 1,
    criteriaTags: ["Troubleshooting", "Structured diagnostic state", "Information-gain questioning"],
    expectedHighlights: [
      "Machine Detective session starts automatically",
      "Ranked hypotheses with evidence bars",
      "One high-information clarification question",
      "Confidence collapse as causes narrow",
    ],
    action: "chat",
  },
  {
    id: "settings-configurator",
    title: "Settings Configurator",
    subtitle: "Documented settings from door chart guidance",
    mode: "settings",
    prompt:
      "I'm welding 1/8 inch mild steel with MIG solid wire on 240V. What consumables and settings should I use?",
    durationMinutes: 0.75,
    criteriaTags: ["Settings lookup", "Safe artifacts", "Evidence validation"],
    expectedHighlights: [
      "Recommended documented settings (door chart — no invented numbers)",
      "Polarity diagram (DCEP)",
      "Configuration summary card",
      "Validation warnings and manual citations",
    ],
    action: "settings-pack",
    setupInputs: {
      process: "mig-solid",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "ER70S-6 solid wire",
      wireDiameter: '0.030"',
      shielding: "c25",
    },
  },
  {
    id: "visual-diagnosis",
    title: "Visual Diagnosis",
    subtitle: "Photo analysis vs manual exemplars",
    mode: "diagnose",
    prompt: "Analyze this weld photo and compare with the manual diagnosis guide.",
    durationMinutes: 1,
    criteriaTags: ["Multimodal evidence", "Visual content", "Uncertainty-aware guidance"],
    expectedHighlights: [
      "Visual observations from uploaded sample weld",
      "Side-by-side comparison with manual p.37 porosity figure",
      "Uncertainty-aware next step (not repair confirmation)",
      "Grounding layer flags overconfidence",
    ],
    action: "visual-analysis",
    sampleImagePath: "/demo/sample-weld-porosity.svg",
    visionContext: {
      process: "flux",
      inputVoltage: 240,
      material: "Mild Steel",
      userNotes: "flux-core porosity sample for demo",
    },
  },
];

export const DEMO_DIFFERENTIATORS = [
  {
    title: "Executable machine knowledge",
    description:
      "Polarity rules, duty cycles, and fault graphs are queryable — not plain text chunks pasted into a prompt.",
  },
  {
    title: "Multimodal evidence retrieval",
    description:
      "Manual figures, door charts, and weld-diagnosis photos surface with source, page, and section provenance.",
  },
  {
    title: "Structured diagnostic state",
    description:
      "Machine Detective tracks hypotheses, ruled-out causes, and session memory across turns.",
  },
  {
    title: "Information-gain questioning",
    description:
      "One clarification at a time — chosen to separate the most plausible faults, not a generic checklist.",
  },
  {
    title: "Safe generated artifacts",
    description:
      "Typed ArtifactSpec components only — no arbitrary model HTML or JavaScript.",
  },
  {
    title: "Deterministic calculators",
    description:
      "Duty cycle math and configuration validation run in code, grounded in ingested manual tables.",
  },
  {
    title: "Evidence coverage validation",
    description:
      "Every response passes grounding checks before display — conflicts and gaps are shown, not hidden.",
  },
];

export function getDemoScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}

export const TOTAL_DEMO_MINUTES = DEMO_SCENARIOS.reduce((sum, s) => sum + s.durationMinutes, 0);
