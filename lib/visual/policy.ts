import type { Citation } from "@/lib/schemas/conversation";
import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import { getAssetById } from "@/lib/manual/assets";
import { getPageRenderPath } from "@/lib/retrieval/search";
import { MANUAL_DEFECT_EXEMPLARS } from "@/lib/vision/exemplars";
import {
  bestFigureForQuery,
  pageAssetId,
  QUERY_PAGE_HINTS,
} from "@/lib/visual/figures";
import type {
  FigureCandidate,
  RankedFigure,
  VisualArtifactType,
  VisualPolicyInput,
} from "@/lib/visual/types";

const LOCATION_PATTERN =
  /\b(where|locate|location|plug(?:\s+in)?|connect|socket|port|outlet|inlet|mechanism|panel|control|knob|clamp|torch|regulator|cylinder|bottle)\b/i;
const CABLE_PATTERN =
  /\b(which cable|cable.*(?:where|go|connect)|routing|goes where|plug.*cable)\b/i;
const POLARITY_PATTERN = /\b(polarity|dcep|dcen|positive|negative)\b/i;
const DEFECT_PATTERN =
  /\b(porosity|spatter|burn[- ]?through|defect|diagnosis|weld example|weld diagnosis)\b/i;
const CHART_PATTERN =
  /\b(selection chart|settings chart|setup chart|door chart|chart.*settings)\b/i;
const EXPLICIT_VISUAL_PATTERN =
  /\b(show me|show the|diagram|label|identify|point out|draw|illustrat)/i;

/** Known annotated regions for pages where manual diagrams have stable callouts. */
const KNOWN_ANNOTATIONS: Record<
  string,
  Extract<ArtifactSpec, { type: "annotated-manual-figure" }>
> = {
  "owner-manual.pdf:8": {
    type: "annotated-manual-figure",
    title: "Front Panel Controls",
    caption: "Positive socket, negative socket, and MIG gun cable socket",
    assetId: pageAssetId("owner-manual.pdf", 8),
    source: "owner-manual.pdf",
    page: 8,
    regions: [
      {
        id: "pos",
        label: "Positive socket",
        x: 62,
        y: 38,
        width: 12,
        height: 10,
        description: "Work clamp / electrode positive",
      },
      {
        id: "neg",
        label: "Negative socket",
        x: 28,
        y: 38,
        width: 12,
        height: 10,
        description: "Torch or gun negative",
      },
    ],
    callouts: [
      { id: "c1", label: "Positive (+) socket", x: 68, y: 35, targetRegionId: "pos" },
      { id: "c2", label: "Negative (−) socket", x: 34, y: 35, targetRegionId: "neg" },
    ],
    citations: [{ source: "owner-manual.pdf", page: 8, section: "Front Panel Controls" }],
    confidence: "high",
  },
};

export function shouldAttachVisual(input: VisualPolicyInput): boolean {
  const q = input.query;
  if (EXPLICIT_VISUAL_PATTERN.test(q)) return true;
  if (LOCATION_PATTERN.test(q)) return true;
  if (CABLE_PATTERN.test(q)) return true;
  if (POLARITY_PATTERN.test(q)) return true;
  if (DEFECT_PATTERN.test(q)) return true;
  if (CHART_PATTERN.test(q)) return true;
  if (input.hasUserImage) return true;
  if (input.category === "visual_content") return true;
  if (input.category === "machine_setup" && /connect|attach|hook|install|setup/i.test(q)) {
    return true;
  }
  if ((input.requiredTypes ?? []).some((t) => t.includes("figure") || t.includes("diagram"))) {
    return true;
  }
  return QUERY_PAGE_HINTS.some((h) => h.pattern.test(q));
}

export function selectVisualArtifactTypes(input: VisualPolicyInput): VisualArtifactType[] {
  const selected = new Set<VisualArtifactType>();
  const q = input.query;

  if (!shouldAttachVisual(input) && !(input.requiredTypes?.length)) {
    return [];
  }

  if (POLARITY_PATTERN.test(q) || /socket.*polarity/i.test(q)) {
    selected.add("polarity-diagram");
  }
  if (CABLE_PATTERN.test(q) || /which cable/i.test(q)) {
    selected.add("cable-routing-diagram");
  }
  if (DEFECT_PATTERN.test(q) || input.hasUserImage) {
    selected.add("weld-defect-comparison");
  }
  if (CHART_PATTERN.test(q) || input.category === "settings") {
    selected.add("settings-configurator");
  }
  if (/front panel|label.*control|component map|control panel/i.test(q)) {
    selected.add("component-map");
  }

  const ranked = bestFigureForQuery(q, input.acceptedPages);
  const annotationKey = ranked
    ? `${ranked.provenance.source}:${ranked.provenance.page}`
    : null;
  if (
    annotationKey &&
    KNOWN_ANNOTATIONS[annotationKey] &&
    /panel|control|socket|label|polarity/i.test(q)
  ) {
    selected.add("annotated-manual-figure");
  }

  // Generic page-render fallback — only add it when no more specific
  // diagram type already matched. Downstream artifact selection uses
  // "last registered wins" semantics, so unconditionally adding the
  // generic manual-figure here would shadow a more specific, deterministic
  // diagram (e.g. polarity-diagram) that already answers the question,
  // causing the model to waste an extra turn trying to regenerate it.
  if (
    (input.requiredTypes ?? []).includes("manual-figure") ||
    (selected.size === 0 && shouldAttachVisual(input))
  ) {
    selected.add("manual-figure");
  }

  for (const required of input.requiredTypes ?? []) {
    if (
      required === "manual-figure" ||
      required === "annotated-manual-figure" ||
      required === "polarity-diagram" ||
      required === "cable-routing-diagram" ||
      required === "weld-defect-comparison" ||
      required === "settings-configurator" ||
      required === "component-map"
    ) {
      selected.add(required);
    }
  }

  return [...selected];
}

export function resolveFigureImagePath(spec: {
  assetId: string;
  source: string;
  page: number;
  imagePath?: string;
}): string {
  if (spec.imagePath) return spec.imagePath;
  const asset = getAssetById(spec.assetId);
  if (asset?.path) return asset.path;
  return getPageRenderPath(spec.source, spec.page);
}

export function buildManualFigureArtifact(
  figure: RankedFigure | FigureCandidate,
  options?: {
    title?: string;
    citations?: Citation[];
    query?: string;
  },
): Extract<ArtifactSpec, { type: "manual-figure" }> {
  const source = figure.provenance.source;
  const page = figure.provenance.page;
  const assetId = figure.isPageFallback ? figure.id : figure.id;
  const imagePath =
    figure.provenance.assetPath ??
    getAssetById(assetId)?.path ??
    getPageRenderPath(source, page);

  const fallbackNote = figure.isPageFallback
    ? "Full manual page shown — no cropped figure asset is available for this section."
    : undefined;

  return {
    type: "manual-figure",
    title: options?.title ?? `Manual figure — p.${page}`,
    caption: figure.caption,
    assetId,
    source,
    page,
    imagePath,
    fallbackNote,
    figureId: figure.isPageFallback ? undefined : figure.id,
    citations:
      options?.citations ??
      [{ source, page, excerpt: figure.caption.slice(0, 200) }],
    confidence: figure.isPageFallback ? "medium" : "high",
  };
}

export function buildAnnotatedManualFigureArtifact(
  figure: RankedFigure,
  citations?: Citation[],
): Extract<ArtifactSpec, { type: "annotated-manual-figure" }> | null {
  const key = `${figure.provenance.source}:${figure.provenance.page}`;
  const known = KNOWN_ANNOTATIONS[key];
  if (!known) return null;

  return {
    ...known,
    assetId: figure.id,
    imagePath: figure.provenance.assetPath,
    citations: citations ?? known.citations,
  };
}

export function buildWeldDefectComparisonFromManual(
  query: string,
  page = 37,
): Extract<ArtifactSpec, { type: "weld-defect-comparison" }> {
  const lower = query.toLowerCase();
  const defectMatch =
    MANUAL_DEFECT_EXEMPLARS.find((e) =>
      e.defectCategories.some((c) => lower.includes(c.replace(/_/g, " ")) || lower.includes(c)),
    ) ?? MANUAL_DEFECT_EXEMPLARS.find((e) => e.page === page);

  const pageExemplars = MANUAL_DEFECT_EXEMPLARS.filter((e) => e.page === page).slice(0, 4);

  return {
    type: "weld-defect-comparison",
    title: "Weld Diagnosis Examples",
    description: "Manual weld defect reference images from the owner's manual.",
    defectName: defectMatch?.label.replace(/^Wire Weld – /, "") ?? "Porosity",
    userDescription: query,
    exemplars: pageExemplars.map((e) => ({
      id: e.id,
      label: e.label,
      description: e.description,
      assetId: e.assetId,
      source: e.source,
      page: e.page,
      matchScore: e.id === defectMatch?.id ? 0.9 : 0.5,
    })),
    selectedExemplarId: defectMatch?.id,
    citations: [{ source: "owner-manual.pdf", page, excerpt: defectMatch?.manualText?.slice(0, 200) }],
    confidence: "high",
    uncertaintyNotes: [],
    possibleCategories: defectMatch?.defectCategories ?? ["porosity"],
    visualObservations: [],
    potentialCauses: defectMatch ? [defectMatch.manualText] : [],
  };
}

export function buildComponentMapArtifact(
  query: string,
  page = 8,
): Extract<ArtifactSpec, { type: "component-map" }> {
  const components =
    page === 8
      ? [
          { id: "lcd", name: "LCD Display", x: 50, y: 28, description: "Process and settings display" },
          { id: "control-knob", name: "Control Knob", x: 38, y: 55, description: "Main control knob" },
          { id: "left-knob", name: "Left Knob", x: 22, y: 55 },
          { id: "right-knob", name: "Right Knob", x: 62, y: 55 },
          { id: "pos-socket", name: "Positive Socket", x: 72, y: 72, highlighted: true },
          { id: "neg-socket", name: "Negative Socket", x: 18, y: 72, highlighted: true },
        ]
      : [];

  return {
    type: "component-map",
    title: "Front Panel Controls",
    description: "Controls and sockets from the manual front panel diagram.",
    view: "front_panel",
    components,
    citations: [{ source: "owner-manual.pdf", page, section: "Front Panel Controls" }],
    confidence: "high",
  };
}

export function resolveTargetFigure(
  input: VisualPolicyInput,
): RankedFigure | null {
  return bestFigureForQuery(input.query, input.acceptedPages);
}
