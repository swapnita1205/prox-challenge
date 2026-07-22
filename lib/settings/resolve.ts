import { retrieve } from "@/lib/retrieval/engine";
import { bundleToCitations } from "@/lib/retrieval/citations";
import { getPolarityForProcess } from "@/lib/setup/documented-polarity";
import type { SetupProcess } from "@/lib/setup/schemas";
import { buildSettingsNaturalLanguageAnswer } from "@/lib/settings/answer";
import {
  CHART_LOCATION_SOURCES,
  CHART_MAX_STEEL_INCHES,
  CHART_THICKNESS_ROWS,
  findMatchingChartRows,
  WELDABLE_MATERIALS_SOURCE,
} from "@/lib/settings/chart-records";
import { extractSettingsParams } from "@/lib/settings/extract-params";
import type {
  SettingsLookupInput,
  SettingsResolution,
  SettingsSourceRecord,
} from "@/lib/settings/schemas";
import settingsData from "@/data/generated/settings.json";

function setupProcess(process: SettingsResolution["process"]): SetupProcess | null {
  if (process === "mig") return "mig-solid";
  if (process === "flux") return "flux";
  if (process === "tig") return "tig";
  if (process === "stick") return "stick";
  return null;
}

function detectConflicts(params: ReturnType<typeof extractSettingsParams>): string[] {
  const conflicts: string[] = [];
  const { process, wireType, material } = params;

  if (process === "mig" && wireType && /flux/i.test(wireType)) {
    conflicts.push("Flux-cored wire is incompatible with MIG solid-core (gas-shielded) process.");
  }
  if (process === "flux" && wireType && /solid/i.test(wireType) && !/flux/i.test(wireType)) {
    conflicts.push("Solid core wire is incompatible with flux-core process.");
  }
  if (process === "flux" && material && /alumin/i.test(material)) {
    conflicts.push("Flux-core door chart rows in the manual target steel — aluminum is not documented on the indexed chart.");
  }
  if (process === "stick" || process === "tig") {
    conflicts.push(
      `${process.toUpperCase()} does not use the wire-feed door settings chart — voltage and wire speed are not applicable.`,
    );
  }

  return conflicts;
}

function missingParameters(params: ReturnType<typeof extractSettingsParams>): string[] {
  const missing: string[] = [];
  if (!params.process) missing.push("process");
  if (!params.material) missing.push("material");
  if (!params.thicknessNormalized && !params.thickness) missing.push("thickness");
  return missing;
}

function buildSourceRecords(
  chartRows: ReturnType<typeof findMatchingChartRows>,
  includeLocation: boolean,
): SettingsSourceRecord[] {
  const records: SettingsSourceRecord[] = [];

  if (includeLocation) {
    for (const src of CHART_LOCATION_SOURCES) {
      records.push({
        id: `src-${src.source}-p${src.page}`,
        source: src.source,
        page: src.page,
        section: src.section,
        excerpt: src.excerpt,
        recordType: src.source.includes("selection") ? "selection_chart" : "setup_procedure",
        assetPath: "/manual-assets/selection-chart/p01.png",
      });
    }
  }

  for (const row of chartRows) {
    records.push({
      id: row.id,
      source: row.source.source,
      page: row.source.page,
      section: row.source.section,
      excerpt: `Chart row ${row.thicknessLabel} for ${row.process} — ${paramsMaterialLabel(row)}`,
      recordType: "selection_chart",
      assetPath: "/manual-assets/selection-chart/p01.png",
    });
  }

  records.push({
    id: "src-weldable-materials",
    source: WELDABLE_MATERIALS_SOURCE.source,
    page: WELDABLE_MATERIALS_SOURCE.page,
    section: WELDABLE_MATERIALS_SOURCE.section,
    excerpt: WELDABLE_MATERIALS_SOURCE.excerpt,
    recordType: "specification",
  });

  return dedupeRecords(records);
}

function paramsMaterialLabel(row: (typeof CHART_THICKNESS_ROWS)[0]): string {
  return row.materialPatterns.map((p) => p.source).join("/");
}

function dedupeRecords(records: SettingsSourceRecord[]): SettingsSourceRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    const key = `${r.source}:${r.page}:${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chartIsImageOnly(): boolean {
  const record = settingsData[0] as { needsMultimodalInterpretation?: boolean; data: unknown };
  return record?.needsMultimodalInterpretation === true || record?.data == null;
}

/** Resolve settings from user query and/or structured parameters. */
export function resolveSettings(input: SettingsLookupInput): SettingsResolution {
  const params = extractSettingsParams(input);
  const conflicts = detectConflicts(params);

  const isLocationQuery =
    !!input.query &&
    /where.*(find|chart|settings|voltage|wire speed)/i.test(input.query);

  const missing = isLocationQuery ? [] : missingParameters(params);

  const base: SettingsResolution = {
    process: params.process,
    material: params.material,
    thickness: params.thickness,
    thicknessNormalized: params.thicknessNormalized ?? undefined,
    inputVoltage: params.inputVoltage,
    wireType: params.wireType,
    wireDiameter: params.wireDiameter,
    shieldingGas: params.shieldingGas,
    polarity: undefined,
    voltageSetting: undefined,
    wireFeedSetting: undefined,
    amperageSetting: undefined,
    sourceRecords: [],
    missingRequiredParameters: missing,
    conflicts,
    recommendationStatus: "partial",
    clarifyingQuestion: undefined,
    naturalLanguageAnswer: "",
    citations: [],
  };

  if (conflicts.length > 0) {
    const resolution: SettingsResolution = {
      ...base,
      recommendationStatus: "conflicting",
      naturalLanguageAnswer: "",
      citations: [],
    };
    resolution.naturalLanguageAnswer = buildSettingsNaturalLanguageAnswer(resolution);
    return resolution;
  }

  if (missing.length > 0) {
    const clarifying =
      missing.includes("process")
        ? "Which welding process are you using — MIG solid core, flux-core, TIG, or stick?"
        : missing.includes("material")
          ? "What material are you welding (e.g. mild steel, stainless)?"
          : missing.includes("thickness")
            ? "What material thickness (e.g. 1/8 inch or 3.2 mm)?"
            : missing.includes("wire type or wire diameter")
              ? "Is your wire solid core, flux-cored, or what diameter are you using?"
              : undefined;

    const resolution: SettingsResolution = {
      ...base,
      recommendationStatus: "partial",
      clarifyingQuestion: clarifying,
      naturalLanguageAnswer: "",
      citations: [],
    };
    resolution.naturalLanguageAnswer = buildSettingsNaturalLanguageAnswer(resolution);
    return resolution;
  }

  const setupProc = setupProcess(params.process);
  if (setupProc) {
    const pol = getPolarityForProcess(setupProc);
    base.polarity = pol.polarityType;
  }

  // Chart location query (no thickness required)
  if (isLocationQuery) {
    const resolution: SettingsResolution = {
      ...base,
      sourceRecords: buildSourceRecords([], true),
      recommendationStatus: "multimodal_required",
      naturalLanguageAnswer: "",
      citations: CHART_LOCATION_SOURCES.map((s) => ({
        source: s.source,
        page: s.page,
        section: s.section,
        excerpt: s.excerpt,
      })),
    };
    resolution.naturalLanguageAnswer = buildSettingsNaturalLanguageAnswer(resolution);
    return resolution;
  }

  const thicknessInches = params.thicknessNormalized?.inches;

  if (thicknessInches !== undefined && thicknessInches > CHART_MAX_STEEL_INCHES) {
    const resolution: SettingsResolution = {
      ...base,
      recommendationStatus: "unsupported",
      sourceRecords: [WELDABLE_MATERIALS_SOURCE].map((s) => ({
        id: "src-spec",
        source: s.source,
        page: s.page,
        section: s.section,
        excerpt: s.excerpt,
        recordType: "specification" as const,
      })),
      naturalLanguageAnswer: "",
      citations: [{ source: WELDABLE_MATERIALS_SOURCE.source, page: WELDABLE_MATERIALS_SOURCE.page }],
    };
    resolution.naturalLanguageAnswer = buildSettingsNaturalLanguageAnswer(resolution);
    return resolution;
  }

  const matchingRows = findMatchingChartRows({
    process: params.process,
    material: params.material,
    thicknessInches,
  });

  if (matchingRows.length === 0 && params.process && params.material && thicknessInches !== undefined) {
    const resolution: SettingsResolution = {
      ...base,
      recommendationStatus: "unsupported",
      sourceRecords: buildSourceRecords([], true),
      naturalLanguageAnswer: "",
      citations: [{ source: "selection-chart.pdf", page: 1 }],
    };
    resolution.naturalLanguageAnswer = buildSettingsNaturalLanguageAnswer(resolution);
    return resolution;
  }

  if (matchingRows.length > 1) {
    const labels = [...new Set(matchingRows.map((r) => r.thicknessLabel))];
    const resolution: SettingsResolution = {
      ...base,
      recommendationStatus: "partial",
      clarifyingQuestion: `Multiple chart rows may apply (${labels.join(", ")}). Confirm exact thickness and wire diameter.`,
      missingRequiredParameters: ["thickness confirmation"],
      sourceRecords: buildSourceRecords(matchingRows, true),
      naturalLanguageAnswer: "",
      citations: matchingRows.map((r) => ({
        source: r.source.source,
        page: r.source.page,
        section: r.source.section,
        excerpt: r.source.excerpt,
      })),
    };
    resolution.naturalLanguageAnswer = buildSettingsNaturalLanguageAnswer(resolution);
    return resolution;
  }

  // Retrieve supporting evidence
  const query = [
    input.query,
    params.process,
    params.material,
    params.thicknessNormalized?.label ?? params.thickness,
    params.inputVoltage && `${params.inputVoltage}V`,
    "settings selection chart door",
  ]
    .filter(Boolean)
    .join(" ");

  const bundle = retrieve(query, { limitPerTask: 5 });
  const retrievalCitations = bundleToCitations(bundle);

  const chartRows = matchingRows.length > 0 ? matchingRows : [];
  const sourceRecords = buildSourceRecords(chartRows, true);

  const hasNumericData = chartRows.some(() => false); // image-only chart — never true today

  const resolution: SettingsResolution = {
    ...base,
    thickness: params.thicknessNormalized?.original ?? params.thickness,
    sourceRecords,
    recommendationStatus: hasNumericData ? "resolved" : "multimodal_required",
    voltageSetting: undefined,
    wireFeedSetting: undefined,
    amperageSetting: undefined,
    naturalLanguageAnswer: "",
    citations: dedupeCitations([
      ...sourceRecords.map((r) => ({
        source: r.source,
        page: r.page,
        section: r.section,
        excerpt: r.excerpt,
      })),
      ...retrievalCitations,
    ]),
  };

  if (chartIsImageOnly()) {
    resolution.recommendationStatus = "multimodal_required";
  }

  if (!params.inputVoltage && params.process === "mig") {
    resolution.missingRequiredParameters = [...resolution.missingRequiredParameters, "input voltage (120V or 240V)"];
    if (!resolution.clarifyingQuestion) {
      resolution.clarifyingQuestion =
        "Are you on 120V or 240V input? Duty cycle and chart row selection may differ.";
    }
  }

  resolution.naturalLanguageAnswer = buildSettingsNaturalLanguageAnswer(resolution);
  return resolution;
}

function dedupeCitations(
  citations: Array<{ source: string; page: number; section?: string; excerpt?: string }>,
) {
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = `${c.source}:${c.page}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
