import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import type { SetupProcess } from "@/lib/setup/schemas";
import { getPolarityForProcess } from "@/lib/setup/documented-polarity";
import type { SettingsResolution } from "@/lib/settings/schemas";

function toSetupProcess(process: SettingsResolution["process"]): SetupProcess | null {
  if (process === "mig") return "mig-solid";
  if (process === "flux") return "flux";
  if (process === "tig") return "tig";
  if (process === "stick") return "stick";
  return null;
}

export function buildSettingsConfiguratorArtifact(
  resolution: SettingsResolution,
): ArtifactSpec | null {
  if (!resolution.process) return null;

  const setupProcess = toSetupProcess(resolution.process);
  const pol = setupProcess ? getPolarityForProcess(setupProcess) : null;

  const gasLabel =
    resolution.shieldingGas ??
    (resolution.process === "mig"
      ? "C25 (75% Ar / 25% CO₂) per manual p.14"
      : resolution.process === "flux"
        ? resolution.wireType?.includes("gas")
          ? "Shielding gas per wire supplier"
          : "Self-shielded — no external gas"
        : resolution.process === "tig"
          ? "100% Argon"
          : "N/A (stick)");

  const notes =
    resolution.recommendationStatus === "multimodal_required"
      ? `Chart row matched — read voltage and wire speed on the door chart (selection-chart.pdf p.1). Status: ${resolution.recommendationStatus}.`
      : resolution.recommendationStatus === "resolved"
        ? "Values from documented manual records."
        : resolution.naturalLanguageAnswer.slice(0, 300);

  return {
    type: "settings-configurator",
    title: "Consumables & Settings",
    description: resolution.naturalLanguageAnswer.slice(0, 500),
    process: resolution.process,
    material: resolution.material,
    thickness: resolution.thicknessNormalized?.label ?? resolution.thickness,
    wireDiameter: resolution.wireDiameter,
    gas: gasLabel,
    inputVoltage: resolution.inputVoltage,
    wireType: resolution.wireType,
    recommended: {
      voltage: resolution.voltageSetting,
      wireSpeed: resolution.wireFeedSetting,
      gasFlow: resolution.shieldingGas,
      amperage: resolution.amperageSetting,
      notes,
      recommendationStatus: resolution.recommendationStatus,
      thicknessOriginal: resolution.thickness,
      thicknessNormalized: resolution.thicknessNormalized?.label,
      polarity: resolution.polarity,
    },
    polarityRef: pol
      ? {
          groundSocket: pol.groundSocket,
          electrodeSocket: pol.electrodeSocket,
          polarityType: pol.polarityType,
        }
      : undefined,
    setupChecklist: [],
    supportingEvidence: resolution.sourceRecords.map(
      (r) => `${r.source} p.${r.page}${r.section ? ` — ${r.section}` : ""}`,
    ),
    citations: resolution.citations,
    confidence:
      resolution.recommendationStatus === "resolved"
        ? "high"
        : resolution.recommendationStatus === "multimodal_required"
          ? "medium"
          : "low",
  };
}
