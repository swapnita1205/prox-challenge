/**
 * Documented door-chart row metadata derived from manual evidence.
 * Numeric voltage / wire-speed / amperage values are NOT stored here —
 * selection-chart.pdf is image-only (settings.json data: null).
 */
import type { SettingsProcess } from "@/lib/settings/schemas";

export interface ChartThicknessRow {
  id: string;
  process: SettingsProcess;
  /** Case-insensitive material patterns */
  materialPatterns: RegExp[];
  thicknessMinInches: number;
  thicknessMaxInches: number;
  /** Canonical chart row label */
  thicknessLabel: string;
  wireDiameters?: string[];
  source: { source: string; page: number; section?: string; excerpt?: string };
}

const CHART_SOURCE = {
  source: "selection-chart.pdf",
  page: 1,
  section: "Settings Chart",
  excerpt:
    "Recommended wire speed and voltage values — door chart (image; requires chart lookup or multimodal interpretation).",
} as const;

const DOOR_REFERENCE = {
  source: "owner-manual.pdf",
  page: 14,
  section: "DCEP Solid Core Setup",
  excerpt: "Refer to the Settings Chart on the inside of the Welder door.",
} as const;

const SPEC_SOURCE = {
  source: "owner-manual.pdf",
  page: 7,
  section: "Specifications",
  excerpt: "Weldable Materials: Mild Steel, Stainless Steel, Aluminum (with optional Spool Gun).",
} as const;

function row(
  id: string,
  process: SettingsProcess,
  materialPatterns: RegExp[],
  thicknessLabel: string,
  inches: number,
  tolerance = 0.008,
): ChartThicknessRow {
  return {
    id,
    process,
    materialPatterns,
    thicknessMinInches: inches - tolerance,
    thicknessMaxInches: inches + tolerance,
    thicknessLabel,
    source: CHART_SOURCE,
  };
}

/** Chart rows for MIG / flux wire processes — thickness bands only, no invented settings. */
export const CHART_THICKNESS_ROWS: ChartThicknessRow[] = [
  row("mig-mild-1-16", "mig", [/mild\s*steel/i], '1/16"', 1 / 16),
  row("mig-mild-1-8", "mig", [/mild\s*steel/i], '1/8"', 1 / 8),
  row("mig-mild-3-16", "mig", [/mild\s*steel/i], '3/16"', 3 / 16),
  row("mig-mild-1-4", "mig", [/mild\s*steel/i], '1/4"', 1 / 4),
  row("mig-stainless-1-8", "mig", [/stainless/i], '1/8"', 1 / 8),
  row("flux-mild-1-8", "flux", [/mild\s*steel/i], '1/8"', 1 / 8),
  row("flux-mild-3-16", "flux", [/mild\s*steel/i], '3/16"', 3 / 16),
  row("flux-mild-1-4", "flux", [/mild\s*steel/i], '1/4"', 1 / 4),
];

/** Maximum documented mild-steel thickness on door chart (no rows beyond 1/4" in indexed metadata). */
export const CHART_MAX_STEEL_INCHES = 0.26;

export const CHART_LOCATION_SOURCES = [CHART_SOURCE, DOOR_REFERENCE];

export const WELDABLE_MATERIALS_SOURCE = SPEC_SOURCE;

export function findMatchingChartRows(params: {
  process?: SettingsProcess;
  material?: string;
  thicknessInches?: number;
}): ChartThicknessRow[] {
  if (!params.process || !params.material || params.thicknessInches === undefined) return [];

  return CHART_THICKNESS_ROWS.filter((row) => {
    if (row.process !== params.process) return false;
    if (!row.materialPatterns.some((p) => p.test(params.material!))) return false;
    return (
      params.thicknessInches! >= row.thicknessMinInches &&
      params.thicknessInches! <= row.thicknessMaxInches
    );
  });
}
