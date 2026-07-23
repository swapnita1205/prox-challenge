import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import type { Citation } from "@/lib/schemas/conversation";
import { getPolarityForProcess } from "@/lib/setup/documented-polarity";
import type { SetupInputs, SetupPack, SetupProcess } from "@/lib/setup/schemas";
import { processToSlug } from "@/lib/setup/schemas";
import { validateSetupInputs } from "@/lib/setup/validate";
import { buildSettingsConfiguratorArtifact, resolveSettings } from "@/lib/settings";

export function buildPolarityDiagram(process: SetupProcess): ArtifactSpec {
  const pol = getPolarityForProcess(process);
  return {
    type: "polarity-diagram",
    title: `${pol.process === "mig-solid" ? "MIG Solid" : pol.process.toUpperCase()} — ${pol.polarityType} Polarity`,
    description: pol.verified
      ? "Verified polarity from owner manual."
      : "Manual-cited polarity — verify on machine before welding.",
    process: process === "mig-solid" ? "mig-solid" : process,
    polarityType: pol.polarityType,
    groundSocket: pol.groundSocket,
    electrodeSocket: pol.electrodeSocket,
    groundLabel: pol.groundLabel,
    electrodeLabel: pol.electrodeLabel,
    citations: pol.citations,
    confidence: pol.verified ? "high" : "medium",
    safetyNotice: "Turn OFF power and unplug before connecting cables.",
  };
}

export function buildCableRouting(process: SetupProcess): ArtifactSpec {
  const pol = getPolarityForProcess(process);
  const routes =
    process === "mig-solid" || process === "flux"
      ? [
          {
            id: "r-ground",
            cable: "Ground Clamp Cable",
            from: pol.groundLabel,
            to: `${pol.groundSocket === "positive" ? "Positive (+)" : "Negative (−)"} Socket`,
            socket: pol.groundSocket,
            color: "orange" as const,
          },
          {
            id: "r-electrode",
            cable: process === "flux" ? "Wire Feed Power Cable" : "Wire Feed Power Cable",
            from: pol.electrodeLabel,
            to: `${pol.electrodeSocket === "positive" ? "Positive (+)" : "Negative (−)"} Socket`,
            socket: pol.electrodeSocket,
            color: "blue" as const,
          },
        ]
      : process === "tig"
        ? [
            {
              id: "r-ground",
              cable: "Ground Clamp Cable",
              from: "Ground Clamp",
              to: "Positive (+) Socket",
              socket: "positive" as const,
              color: "orange" as const,
            },
            {
              id: "r-torch",
              cable: "TIG Torch Cable",
              from: "TIG Torch",
              to: "Negative (−) Socket",
              socket: "negative" as const,
              color: "blue" as const,
            },
          ]
        : [
            {
              id: "r-ground",
              cable: "Ground Clamp Cable",
              from: "Ground Clamp",
              to: "Negative (−) Socket",
              socket: "negative" as const,
              color: "orange" as const,
            },
            {
              id: "r-holder",
              cable: "Electrode Holder Cable",
              from: "Electrode Holder",
              to: "Positive (+) Socket",
              socket: "positive" as const,
              color: "blue" as const,
            },
          ];

  return {
    type: "cable-routing-diagram",
    title: "Cable Routing",
    description: "Which cable goes into which socket — twist clockwise to lock.",
    process: process === "mig-solid" ? "mig-solid" : process,
    routes,
    citations: getPolarityForProcess(process).citations,
    confidence: getPolarityForProcess(process).verified ? "high" : "medium",
  };
}

function buildSettingsConfigurator(inputs: SetupInputs): ArtifactSpec {
  const resolution = resolveSettings({
    process: inputs.process === "mig-solid" ? "mig" : inputs.process,
    material: inputs.material,
    thickness: inputs.thickness,
    inputVoltage: inputs.inputVoltage,
    wireType: inputs.consumable,
    wireDiameter: inputs.wireDiameter,
    shieldingGas:
      inputs.process === "mig-solid"
        ? "C25"
        : inputs.process === "tig"
          ? "100% Argon"
          : undefined,
  });

  const artifact = buildSettingsConfiguratorArtifact(resolution);
  if (artifact) return artifact;

  const pol = inputs.process ? getPolarityForProcess(inputs.process) : null;
  return {
    type: "settings-configurator",
    title: "Consumables & Settings",
    description: resolution.naturalLanguageAnswer,
    process: inputs.process ? processToSlug(inputs.process) : undefined,
    material: inputs.material,
    thickness: inputs.thickness,
    wireDiameter: inputs.wireDiameter,
    gas: "See manual",
    inputVoltage: inputs.inputVoltage,
    wireType: inputs.consumable,
    recommended: { notes: resolution.naturalLanguageAnswer },
    polarityRef: pol
      ? {
          groundSocket: pol.groundSocket,
          electrodeSocket: pol.electrodeSocket,
          polarityType: pol.polarityType,
        }
      : undefined,
    setupChecklist: [],
    supportingEvidence: resolution.sourceRecords.map(
      (r) => `${r.source} p.${r.page}`,
    ),
    citations: resolution.citations,
    confidence: "low",
  };
}

function wireFeedSteps(process: SetupProcess): Array<{ id: string; label: string; detail?: string; safetyCritical?: boolean }> {
  if (process !== "mig-solid" && process !== "flux") return [];
  return [
    { id: "wf-1", label: "Power OFF — unplug welder", safetyCritical: true },
    { id: "wf-2", label: "Install wire spool (unwinds clockwise)", detail: "owner-manual.pdf p.10" },
    { id: "wf-3", label: "Route wire through drive rolls and liner" },
    { id: "wf-4", label: "Insert gun cable into wire feed socket", detail: "Tighten knob — gas leak if loose (p.13)" },
    { id: "wf-5", label: "Connect wire feed control cable inside machine" },
    { id: "wf-6", label: "Set wire drive tension", detail: "Wire should bend, not stop, at wood block (p.17)" },
    { id: "wf-7", label: "Install correct contact tip for wire diameter", detail: "owner-manual.pdf p.17" },
  ];
}

function preflightSteps(inputs: SetupInputs): Array<{
  id: string;
  label: string;
  detail?: string;
  safetyCritical?: boolean;
}> {
  const base: Array<{ id: string; label: string; detail?: string; safetyCritical?: boolean }> = [
    { id: "pf-1", label: "Read safety section before setup", safetyCritical: true },
    { id: "pf-2", label: "Verify polarity matches process", safetyCritical: true },
    { id: "pf-3", label: "Clamp ground to clean bare metal on workpiece", safetyCritical: true },
  ];
  if (inputs.process === "mig-solid" || (inputs.process === "flux" && inputs.gasShieldedFlux)) {
    base.push({ id: "pf-4", label: "Check gas cylinder secure, regulator connected, hose leak-free" });
    base.push({ id: "pf-5", label: "Confirm gas flows at nozzle when trigger pressed" });
  }
  if (inputs.process === "tig") {
    base.push({ id: "pf-6", label: "Connect 100% argon — TIG torch and foot pedal if used", detail: "p.24" });
  }
  if (inputs.process === "stick") {
    base.push({
      id: "pf-7",
      label: "Electrode holder on non-conductive surface when not in use",
      safetyCritical: true,
      detail: "owner-manual.pdf p.32",
    });
  }
  base.push({ id: "pf-8", label: "Wear shade 10+ face shield, gloves, and protective clothing" });
  return base;
}

function buildChecklist(inputs: SetupInputs): ArtifactSpec {
  const wire = inputs.process ? wireFeedSteps(inputs.process) : [];
  const preflight = preflightSteps(inputs);
  const steps = [...wire, ...preflight];

  return {
    type: "step-by-step-checklist",
    title: inputs.process && (inputs.process === "mig-solid" || inputs.process === "flux")
      ? "Wire-Feed Setup & Preflight"
      : "Preflight Checklist",
    description: "Complete before first arc.",
    steps: steps.map((s) => ({ ...s, completed: false })),
    citations: inputs.process
      ? [{ source: "owner-manual.pdf", page: getPolarityForProcess(inputs.process).manualPage }]
      : [],
    confidence: "high",
    safetyNotice: "Turn OFF power and unplug before interior setup steps.",
  };
}

function buildConfigurationSummary(
  inputs: SetupInputs,
  validation: ReturnType<typeof validateSetupInputs>,
): ArtifactSpec {
  const pol = inputs.process ? getPolarityForProcess(inputs.process) : null;
  const consumables = [inputs.consumable, inputs.wireDiameter ? `${inputs.wireDiameter} wire` : null]
    .filter(Boolean) as string[];

  if (inputs.process === "mig-solid") consumables.push("C25 shielding gas");
  if (inputs.process === "flux" && inputs.gasShieldedFlux) consumables.push("Shielding gas (flux)");

  return {
    type: "configuration-summary",
    title: "Setup Pack Summary",
    description: "Your stated configuration vs manual requirements.",
    process:
      inputs.process === "mig-solid"
        ? "MIG Solid Core"
        : inputs.process
          ? inputs.process.toUpperCase()
          : "Unknown",
    inputVoltage: inputs.inputVoltage,
    polarity: pol?.polarityType,
    consumables,
    components:
      inputs.process === "mig-solid" || inputs.process === "flux"
        ? ["Contact tip", "Gas nozzle", "Wire feed mechanism"]
        : inputs.process === "tig"
          ? ["TIG torch", "Gas regulator"]
          : ["Electrode holder"],
    validationStatus:
      validation.status === "verified"
        ? "verified"
        : validation.status === "invalid"
          ? "invalid"
          : validation.status === "partial"
            ? "partial"
            : "unverified",
    warnings: validation.issues.filter((i) => i.severity === "warning").map((i) => i.message),
    contradictions: validation.issues.filter((i) => i.severity === "error").map((i) => i.message),
    citations: pol?.citations ?? [],
    confidence:
      validation.status === "verified" ? "high" : validation.status === "invalid" ? "low" : "medium",
  };
}

function buildManualFigure(process: SetupProcess): ArtifactSpec {
  const pol = getPolarityForProcess(process);
  const page = pol.manualPage;
  return {
    type: "manual-figure",
    title: `Manual — ${process === "mig-solid" ? "MIG" : process.toUpperCase()} Setup`,
    caption: `Setup diagram and steps — owner-manual.pdf p.${page}`,
    assetId: `owner-manual-p${page}-page`,
    source: "owner-manual.pdf",
    page,
    citations: pol.citations,
    confidence: pol.verified ? "high" : "medium",
  };
}

function buildAskPrompt(inputs: SetupInputs): string {
  const parts = [
    `I'm setting up my OmniPro 220 for ${inputs.process?.replace("-", " ") ?? "welding"}.`,
    inputs.inputVoltage && `Input: ${inputs.inputVoltage}V.`,
    inputs.material && `Material: ${inputs.material}.`,
    inputs.thickness && `Thickness: ${inputs.thickness}.`,
    inputs.consumable && `Consumable: ${inputs.consumable}.`,
    inputs.wireDiameter && `Wire: ${inputs.wireDiameter}.`,
    "Can you confirm this setup and help with any remaining steps?",
  ].filter(Boolean);
  return parts.join(" ");
}

export function buildSetupPack(inputs: SetupInputs): SetupPack {
  const validation = validateSetupInputs(inputs);
  const citations: Citation[] = [];
  const artifacts: ArtifactSpec[] = [];

  if (!inputs.process) {
    return {
      artifacts: [],
      citations: [],
      validation: {
        valid: false,
        status: "invalid",
        issues: validation.issues,
      },
      askPrompt: buildAskPrompt(inputs),
    };
  }

  const process = inputs.process;
  artifacts.push(buildPolarityDiagram(process));
  artifacts.push(buildCableRouting(process));
  artifacts.push(buildSettingsConfigurator(inputs));
  artifacts.push(buildChecklist(inputs));
  artifacts.push(buildConfigurationSummary(inputs, validation));
  artifacts.push(buildManualFigure(process));

  for (const a of artifacts) {
    if ("citations" in a && Array.isArray(a.citations)) {
      citations.push(...(a.citations as Citation[]));
    }
  }

  const uniqueCitations = citations.filter(
    (c, i, arr) => arr.findIndex((x) => x.source === c.source && x.page === c.page) === i,
  );

  return {
    artifacts,
    citations: uniqueCitations,
    validation: {
      valid: validation.valid,
      status: validation.status,
      issues: validation.issues,
    },
    askPrompt: buildAskPrompt(inputs),
    processLabel: process === "mig-solid" ? "MIG Solid Core" : process.toUpperCase(),
  };
}
