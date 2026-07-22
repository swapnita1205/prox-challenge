import type { SetupInputs, WizardStep } from "@/lib/setup/schemas";
import { WIZARD_STEPS } from "@/lib/setup/schemas";

export function getVisibleSteps(inputs: SetupInputs): WizardStep[] {
  const steps: WizardStep[] = ["process", "voltage", "material", "thickness"];

  if (!inputs.process) return steps;

  steps.push("consumable");

  if (inputs.process === "mig-solid" || inputs.process === "flux") {
    steps.push("wire");
  }

  if (
    inputs.process === "mig-solid" ||
    inputs.process === "tig" ||
    inputs.process === "flux"
  ) {
    steps.push("shielding");
  }

  steps.push("optional", "review");
  return steps;
}

export function isStepComplete(step: WizardStep, inputs: SetupInputs): boolean {
  switch (step) {
    case "process":
      return !!inputs.process;
    case "voltage":
      return !!inputs.inputVoltage;
    case "material":
      return !!inputs.material?.trim();
    case "thickness":
      return !!inputs.thickness?.trim();
    case "consumable":
      return !!inputs.consumable?.trim();
    case "wire":
      return !!inputs.wireDiameter?.trim();
    case "shielding":
      if (inputs.process === "mig-solid") return inputs.shielding === "c25" || inputs.shielding === "other";
      if (inputs.process === "flux") return inputs.gasShieldedFlux !== undefined;
      if (inputs.process === "tig") return !!inputs.shielding;
      return true;
    case "optional":
      return true;
    case "review":
      return getVisibleSteps(inputs).every((s) => s === "optional" || s === "review" || isStepComplete(s, inputs));
    default:
      return false;
  }
}

export function canGeneratePack(inputs: SetupInputs): boolean {
  return isStepComplete("review", inputs) && !!inputs.process && !!inputs.inputVoltage;
}

export function getNextStep(current: WizardStep, inputs: SetupInputs): WizardStep | null {
  const visible = getVisibleSteps(inputs);
  const idx = visible.indexOf(current);
  if (idx < 0 || idx >= visible.length - 1) return null;
  return visible[idx + 1] ?? null;
}

export function stepLabel(step: WizardStep): string {
  const labels: Record<WizardStep, string> = {
    process: "Welding process",
    voltage: "Input voltage",
    material: "Base material",
    thickness: "Material thickness",
    consumable: "Wire or electrode",
    wire: "Wire diameter",
    shielding: "Shielding gas",
    optional: "Optional details",
    review: "Review & generate",
  };
  return labels[step];
}

export { WIZARD_STEPS };
