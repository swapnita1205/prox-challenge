export interface SafetyCheckResult {
  passed: boolean;
  warnings: string[];
  blockers: string[];
}

const REQUIRED_PPE = [
  "shade 10+ face shield or welding mask",
  "welding gloves",
  "fire-resistant clothing without pockets",
];

export function validateSafetyContext(context: {
  mentionsArc?: boolean;
  mentionsPower?: boolean;
  mentionsBypassInterlock?: boolean;
  safetyAcknowledged?: boolean;
}): SafetyCheckResult {
  const warnings: string[] = [];
  const blockers: string[] = [];

  if (context.mentionsArc && !context.safetyAcknowledged) {
    warnings.push(
      `Wear required PPE before welding: ${REQUIRED_PPE.join(", ")}.`,
    );
  }

  if (context.mentionsPower) {
    warnings.push(
      "Turn off, disconnect power, and allow unit to cool before internal adjustments.",
    );
  }

  if (context.mentionsBypassInterlock) {
    blockers.push("Never bypass door or safety interlocks.");
  }

  return {
    passed: blockers.length === 0,
    warnings,
    blockers,
  };
}
