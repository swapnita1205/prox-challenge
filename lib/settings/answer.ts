import type { SetupProcess } from "@/lib/setup/schemas";
import { getPolarityForProcess } from "@/lib/setup/documented-polarity";
import type { SettingsResolution } from "@/lib/settings/schemas";
import { formatThicknessForAnswer } from "@/lib/settings/thickness";

function processLabel(process: SettingsResolution["process"]): string {
  if (!process) return "unspecified process";
  const map: Record<string, string> = {
    mig: "MIG solid core",
    flux: "flux-core",
    tig: "TIG",
    stick: "stick",
  };
  return map[process] ?? process;
}

function setupProcessFromSlug(process: SettingsResolution["process"]): SetupProcess | null {
  if (process === "mig") return "mig-solid";
  if (process === "flux") return "flux";
  if (process === "tig") return "tig";
  if (process === "stick") return "stick";
  return null;
}

/** Build natural-language answer that preserves all extracted fields for grounding / eval. */
export function buildSettingsNaturalLanguageAnswer(resolution: SettingsResolution): string {
  const parts: string[] = [];

  if (resolution.recommendationStatus === "conflicting") {
    parts.push(
      `I cannot recommend settings because of a configuration conflict: ${resolution.conflicts.join("; ")}.`,
    );
    return parts.join(" ");
  }

  if (resolution.recommendationStatus === "unsupported") {
    parts.push(
      "I could not find a documented door-chart row for the stated material and thickness on the OmniPro 220.",
    );
    if (resolution.process) parts.push(`Process: ${processLabel(resolution.process)}.`);
    if (resolution.material) parts.push(`Material: ${resolution.material}.`);
    if (resolution.thicknessNormalized) {
      parts.push(`Thickness: ${formatThicknessForAnswer(resolution.thicknessNormalized)}.`);
    } else if (resolution.thickness) {
      parts.push(`Thickness: ${resolution.thickness}.`);
    }
    parts.push(
      "Do not guess voltage or wire-speed values — use selection-chart.pdf on the inside of the welder door or upload a photo of the chart.",
    );
    return parts.join(" ");
  }

  if (resolution.recommendationStatus === "partial") {
    parts.push("I need more information before looking up door-chart settings.");
    if (resolution.process) parts.push(`Process so far: ${processLabel(resolution.process)}.`);
    if (resolution.material) parts.push(`Material: ${resolution.material}.`);
    if (resolution.thicknessNormalized) {
      parts.push(`Thickness: ${formatThicknessForAnswer(resolution.thicknessNormalized)}.`);
    }
    parts.push(`Missing: ${resolution.missingRequiredParameters.join(", ")}.`);
    if (resolution.clarifyingQuestion) parts.push(resolution.clarifyingQuestion);
    return parts.join(" ");
  }

  // multimodal_required or resolved
  const header =
    resolution.recommendationStatus === "resolved"
      ? "Documented settings from the manual:"
      : "Settings chart reference (numeric values require door-chart lookup):";

  parts.push(header);

  if (resolution.process) parts.push(`Process: ${processLabel(resolution.process)}.`);
  if (resolution.material) parts.push(`Material: ${resolution.material}.`);
  if (resolution.thicknessNormalized) {
    parts.push(`at ${formatThicknessForAnswer(resolution.thicknessNormalized)}`);
  } else if (resolution.thickness) {
    parts.push(`at ${resolution.thickness}`);
  }
  if (resolution.inputVoltage) parts.push(`with ${resolution.inputVoltage}V input`);

  const setupProcess = setupProcessFromSlug(resolution.process);
  if (setupProcess) {
    const pol = getPolarityForProcess(setupProcess);
    parts.push(`Polarity: ${pol.polarityType} per owner-manual.pdf p.${pol.manualPage}.`);
  }

  if (resolution.wireType) parts.push(`Wire type: ${resolution.wireType}.`);
  if (resolution.wireDiameter) parts.push(`Wire diameter: ${resolution.wireDiameter}.`);
  if (resolution.shieldingGas) parts.push(`Shielding gas: ${resolution.shieldingGas}.`);

  if (resolution.voltageSetting) {
    parts.push(`Documented voltage setting: ${resolution.voltageSetting}.`);
  }
  if (resolution.wireFeedSetting) {
    parts.push(`Documented wire feed: ${resolution.wireFeedSetting}.`);
  }
  if (resolution.amperageSetting) {
    parts.push(`Documented amperage: ${resolution.amperageSetting}.`);
  }

  if (
    !resolution.voltageSetting &&
    !resolution.wireFeedSetting &&
    resolution.recommendationStatus === "multimodal_required"
  ) {
    parts.push(
      "Voltage and wire-speed numbers are on the Settings Chart inside the welder door (selection-chart.pdf p.1; see also owner-manual.pdf p.14 — inside of the Welder door). I am not inventing numeric values — read the chart for your process, material, and thickness row.",
    );
  }

  if (resolution.sourceRecords.length > 0) {
    const refs = resolution.sourceRecords
      .map((r) => `${r.source} p.${r.page}${r.section ? ` (${r.section})` : ""}`)
      .join("; ");
    parts.push(`Sources: ${refs}.`);
  }

  return parts.join(" ");
}
