/** Thickness parsing and equivalence for door-chart matching (deterministic). */

export interface NormalizedThickness {
  /** Canonical display label, e.g. `1/8"` */
  label: string;
  /** Original phrase from user input */
  original: string;
  /** Thickness in inches for range comparison */
  inches: number;
  /** Approximate mm (for display only) */
  millimeters: number;
}

const FRACTION_MAP: Record<string, number> = {
  "1/16": 1 / 16,
  "1/8": 1 / 8,
  "3/16": 3 / 16,
  "1/4": 1 / 4,
  "5/16": 5 / 16,
  "3/8": 3 / 8,
};

const WORD_FRACTIONS: Array<{ pattern: RegExp; inches: number; label: string }> = [
  { pattern: /\beighth[- ]?inch\b/i, inches: 1 / 8, label: '1/8"' },
  { pattern: /\bquarter[- ]?inch\b/i, inches: 1 / 4, label: '1/4"' },
  { pattern: /\bsixteenth[- ]?inch\b/i, inches: 1 / 16, label: '1/16"' },
];

/** Parse thickness from free text or structured input. */
export function parseThickness(raw: string | undefined): NormalizedThickness | null {
  if (!raw?.trim()) return null;
  const original = raw.trim();

  for (const { pattern, inches, label } of WORD_FRACTIONS) {
    if (pattern.test(original)) {
      return toNormalized(original, inches, label);
    }
  }

  const mmMatch = original.match(/(\d+(?:\.\d+)?)\s*mm\b/i);
  if (mmMatch) {
    const mm = parseFloat(mmMatch[1]!);
    const inches = mm / 25.4;
    const label = matchChartLabel(inches) ?? `${mm} mm`;
    return toNormalized(original, inches, label);
  }

  const fracMatch = original.match(/(\d+)\s*\/\s*(\d+)/);
  if (fracMatch) {
    const key = `${fracMatch[1]}/${fracMatch[2]}`;
    const inches = FRACTION_MAP[key];
    if (inches !== undefined) {
      return toNormalized(original, inches, `${key}"`);
    }
  }

  const decimalInch = original.match(/(\d+(?:\.\d+)?)\s*(?:inch|inches|in)\b/i);
  if (decimalInch) {
    const inches = parseFloat(decimalInch[1]!);
    const label = matchChartLabel(inches) ?? `${inches} in`;
    return toNormalized(original, inches, label);
  }

  return null;
}

function toNormalized(original: string, inches: number, label: string): NormalizedThickness {
  return {
    label,
    original,
    inches,
    millimeters: Math.round(inches * 25.4 * 10) / 10,
  };
}

/** Map inches to nearest standard door-chart row label (within tolerance). */
export function matchChartLabel(inches: number): string | null {
  const tolerance = 0.012;
  for (const [frac, value] of Object.entries(FRACTION_MAP)) {
    if (Math.abs(inches - value) <= tolerance) return `${frac}"`;
  }
  return null;
}

export function thicknessesEquivalent(a: NormalizedThickness, b: NormalizedThickness): boolean {
  return Math.abs(a.inches - b.inches) < 0.012;
}

export function formatThicknessForAnswer(t: NormalizedThickness): string {
  return `${t.original} (${t.label}, ${t.millimeters} mm)`;
}
