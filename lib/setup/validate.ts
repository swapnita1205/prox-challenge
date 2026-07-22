import type { Citation } from "@/lib/schemas/conversation";
import type { SetupInputs, SetupValidationIssue } from "@/lib/setup/schemas";
import { processToGraphId } from "@/lib/setup/schemas";
import { getKnowledgeGraph } from "@/lib/knowledge/build";
import { validateConfiguration } from "@/lib/knowledge/queries";
import { CANONICAL_CONSUMABLES } from "@/lib/knowledge/canonical";

const cite = (page: number, section?: string, excerpt?: string): Citation => ({
  source: "owner-manual.pdf",
  page,
  section,
  excerpt,
});

export interface SetupValidationResult {
  valid: boolean;
  status: "verified" | "partial" | "unverified" | "invalid";
  issues: SetupValidationIssue[];
}

function consumableIdFromLabel(label: string | undefined): string | null {
  if (!label) return null;
  const lower = label.toLowerCase();
  const match = CANONICAL_CONSUMABLES.find((c) => lower.includes(c.name.toLowerCase().split(" ")[0]!));
  if (match) return match.id;
  if (/solid/i.test(lower)) return "consumable-solid-wire";
  if (/flux/i.test(lower)) return "consumable-flux-wire";
  if (/argon/i.test(lower)) return "consumable-100-argon";
  if (/c25|75\/25|co2/i.test(lower)) return "consumable-c25-gas";
  if (/electrode|6010|6011|7018/i.test(lower)) return "consumable-stick-electrode";
  return null;
}

export function validateSetupInputs(inputs: SetupInputs): SetupValidationResult {
  const issues: SetupValidationIssue[] = [];

  if (!inputs.process) {
    issues.push({
      code: "missing_process",
      severity: "error",
      message: "Select a welding process before generating a setup pack.",
    });
    return { valid: false, status: "invalid", issues };
  }

  if (!inputs.inputVoltage) {
    issues.push({
      code: "missing_voltage",
      severity: "warning",
      message: "Input voltage (120 V or 240 V) is required for duty-cycle and outlet guidance.",
      citation: cite(7, "Specifications"),
    });
  }

  if (!inputs.material) {
    issues.push({
      code: "missing_material",
      severity: "warning",
      message: "Material is needed to look up settings on the door chart.",
    });
  }

  if (!inputs.thickness) {
    issues.push({
      code: "missing_thickness",
      severity: "warning",
      message: "Thickness is needed to look up settings on the door chart.",
    });
  }

  const wireProcess = inputs.process === "mig-solid" || inputs.process === "flux";
  if (wireProcess && !inputs.wireDiameter) {
    issues.push({
      code: "missing_wire_diameter",
      severity: "warning",
      message: "Wire diameter is required for contact tip selection and tension setup.",
      citation: cite(17, "Contact Tip"),
    });
  }

  if (inputs.process === "mig-solid") {
    if (inputs.shielding && inputs.shielding === "none") {
      issues.push({
        code: "shielding_mismatch",
        severity: "error",
        message: "MIG solid core requires shielding gas — solid wire cannot run gasless on this machine.",
        citation: cite(14, "DCEP Solid Core Setup"),
      });
    }
    if (/flux/i.test(inputs.consumable ?? "")) {
      issues.push({
        code: "process_wire_mismatch",
        severity: "error",
        message: "Flux-cored wire is not correct for MIG solid-core (gas-shielded) setup.",
        citation: cite(14, "Solid Core Setup"),
      });
    }
  }

  if (inputs.process === "flux") {
    const gasless = inputs.gasShieldedFlux === false || inputs.shielding === "none";
    if (gasless && inputs.shielding === "c25") {
      issues.push({
        code: "shielding_mismatch",
        severity: "error",
        message: "Self-shielded flux wire does not use C25 shielding gas.",
        citation: cite(13, "DCEN Flux Setup"),
      });
    }
    if (inputs.gasShieldedFlux && inputs.shielding === "none") {
      issues.push({
        code: "shielding_mismatch",
        severity: "warning",
        message: "Gas-shielded flux wire requires shielding gas per wire supplier.",
        citation: cite(37, "Porosity — shielding gas"),
      });
    }
    if (/solid/i.test(inputs.consumable ?? "") && !/flux/i.test(inputs.consumable ?? "")) {
      issues.push({
        code: "process_wire_mismatch",
        severity: "error",
        message: "Solid core wire is not correct for flux-core process — use flux-cored wire.",
        citation: cite(13, "Flux Setup"),
      });
    }
  }

  if (inputs.process === "tig" && inputs.shielding && inputs.shielding !== "100-argon" && inputs.shielding !== "other") {
    issues.push({
      code: "shielding_mismatch",
      severity: "warning",
      message: "TIG on the OmniPro 220 typically uses 100% argon shielding gas.",
      citation: cite(24, "TIG Setup"),
    });
  }

  if (/alumin/i.test(inputs.material ?? "") && inputs.process === "flux") {
    issues.push({
      code: "unsupported_combination",
      severity: "error",
      message: "Flux-core setup in the manual targets steel wire processes — verify compatibility for aluminum.",
      citation: cite(13, "Wire Setup"),
    });
  }

  if (inputs.inputVoltage === 120 && inputs.thickness && /(1\/2|3\/8|1\/4)/.test(inputs.thickness)) {
    issues.push({
      code: "voltage_limitation",
      severity: "info",
      message:
        "Thicker material on 120 V input may hit current limits — 240 V may be required for adequate heat (verify on door settings chart).",
      citation: cite(7, "Specifications"),
    });
  }

  const graph = getKnowledgeGraph();
  const processId = processToGraphId(inputs.process);
  const consumableIds = [consumableIdFromLabel(inputs.consumable)].filter(Boolean) as string[];
  if (inputs.process === "mig-solid" && inputs.shielding === "c25") {
    consumableIds.push("consumable-c25-gas");
  }
  if (inputs.process === "flux" && !inputs.gasShieldedFlux) {
    consumableIds.push("consumable-flux-wire");
  }

  const graphValidation = validateConfiguration(graph, {
    id: "setup-check",
    processId,
    inputVoltage: inputs.inputVoltage,
    consumableIds,
    componentIds: [],
  });

  for (const c of graphValidation.contradictions) {
    issues.push({
      code: c.type,
      severity: c.verificationStatus === "verified" ? "error" : "warning",
      message: c.message,
    });
  }
  for (const w of graphValidation.warnings) {
    issues.push({ code: "graph_warning", severity: "warning", message: w });
  }
  for (const u of graphValidation.unverified) {
    issues.push({ code: "unverified", severity: "info", message: u });
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasVerifiedPolarity =
    inputs.process === "mig-solid" || inputs.process === "flux";

  let status: SetupValidationResult["status"] = "invalid";
  if (!hasError && hasVerifiedPolarity && inputs.inputVoltage && inputs.material) {
    status = "verified";
  } else if (!hasError) {
    status = inputs.process === "tig" || inputs.process === "stick" ? "partial" : "unverified";
  } else {
    status = "invalid";
  }

  return {
    valid: !hasError && !!inputs.process && !!inputs.inputVoltage,
    status,
    issues,
  };
}
