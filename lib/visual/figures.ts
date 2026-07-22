import figuresData from "@/data/generated/figures.json";
import pagesData from "@/data/generated/pages.json";
import entitiesData from "@/data/generated/entities.json";
import type { FigureCandidate, RankedFigure } from "@/lib/visual/types";
import { tokenize } from "@/lib/retrieval/tokenizer";

type IngestFigure = {
  id: string;
  kind: string;
  caption?: string;
  isDiagram?: boolean;
  provenance: {
    source: string;
    page: number;
    section?: string;
    bbox?: number[];
    neighboringText?: string;
    assetPath?: string;
  };
};

type PageRecord = {
  source: string;
  page: number;
  text: string;
  renderAssetPath?: string;
};

type EntityRecord = {
  label: string;
  text: string;
  processes?: string[];
  provenance: { source: string; page: number; section?: string };
};

/** Deterministic page hints for common visual questions. */
export const QUERY_PAGE_HINTS: Array<{
  pattern: RegExp;
  source: string;
  page: number;
  label: string;
}> = [
  {
    pattern: /shielding gas|gas bottle|regulator|gas inlet|cylinder/i,
    source: "owner-manual.pdf",
    page: 14,
    label: "MIG gas setup",
  },
  {
    pattern: /ground clamp|work clamp/i,
    source: "owner-manual.pdf",
    page: 14,
    label: "Ground clamp polarity setup",
  },
  {
    pattern: /tig torch|foot pedal socket|negative socket.*tig/i,
    source: "owner-manual.pdf",
    page: 24,
    label: "TIG torch connection",
  },
  {
    pattern: /front panel|control panel|lcd|process selection|label.*control/i,
    source: "owner-manual.pdf",
    page: 8,
    label: "Front panel controls",
  },
  {
    pattern: /wire feed mechanism|drive roll|feed tension|liner|idler arm/i,
    source: "owner-manual.pdf",
    page: 17,
    label: "Wire feed mechanism",
  },
  {
    pattern: /porosity|weld diagnosis|defect example|spatter.*manual/i,
    source: "owner-manual.pdf",
    page: 37,
    label: "Weld diagnosis chart",
  },
  {
    pattern: /selection chart|settings chart|door chart/i,
    source: "selection-chart.pdf",
    page: 1,
    label: "Settings selection chart",
  },
];

export function pageAssetId(source: string, page: number): string {
  const slug = source.replace(/\.pdf$/i, "");
  return `${slug}-p${String(page).padStart(2, "0")}-page`;
}

function pageCaption(page: PageRecord): string {
  const match = page.text.match(
    /Front Panel Controls|Interior Controls|Wire Feed|TIG Setup|DCEP|Porosity|Selection/i,
  );
  if (match) return `${match[0]} — ${page.source} p.${page.page}`;
  return `Manual page ${page.page} — ${page.source}`;
}

/** Module-level cache — figure candidates are derived from static build-time
 * JSON, so recomputing this mapping on every call (potentially several times
 * per agent request) is pure overhead. */
let cachedFigureCandidates: FigureCandidate[] | null = null;

export function loadFigureCandidates(): FigureCandidate[] {
  if (cachedFigureCandidates) return cachedFigureCandidates;
  const result = computeFigureCandidates();
  cachedFigureCandidates = result;
  return result;
}

function computeFigureCandidates(): FigureCandidate[] {
  const embedded = (figuresData as IngestFigure[]).map((f) => ({
    id: f.id,
    kind: f.kind,
    caption: f.caption ?? f.kind,
    isDiagram: f.isDiagram ?? false,
    provenance: f.provenance,
    isPageFallback: false,
  }));

  const pageFallbacks = (pagesData as PageRecord[])
    .filter((p) => p.renderAssetPath)
    .map((p) => ({
      id: pageAssetId(p.source, p.page),
      kind: "page_render",
      caption: pageCaption(p),
      isDiagram: true,
      provenance: {
        source: p.source,
        page: p.page,
        assetPath: p.renderAssetPath,
      },
      isPageFallback: true,
    }));

  const byId = new Map<string, FigureCandidate>();
  for (const fig of [...embedded, ...pageFallbacks]) {
    if (!byId.has(fig.id)) byId.set(fig.id, fig);
  }
  return [...byId.values()];
}

function entitiesForPage(source: string, page: number): EntityRecord[] {
  return (entitiesData as EntityRecord[]).filter(
    (e) => e.provenance.source === source && e.provenance.page === page,
  );
}

function scoreTokens(queryTokens: string[], haystack: string): number {
  const lower = haystack.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (lower.includes(token)) hits += 1;
  }
  return queryTokens.length > 0 ? hits / queryTokens.length : 0;
}

export function rankRelevantFigures(
  query: string,
  candidates: FigureCandidate[] = loadFigureCandidates(),
  acceptedPages?: Array<{ source?: string; page: number }>,
): RankedFigure[] {
  const queryTokens = tokenize(query);
  const hints = QUERY_PAGE_HINTS.filter((h) => h.pattern.test(query));

  const ranked = candidates.map((fig) => {
    const reasons: string[] = [];
    let score = 0;

    const textBlob = [
      fig.caption,
      fig.provenance.neighboringText,
      fig.provenance.section,
      fig.kind,
      fig.provenance.source.replace(".pdf", ""),
    ]
      .filter(Boolean)
      .join(" ");

    const tokenScore = scoreTokens(queryTokens, textBlob);
    score += tokenScore * 4;
    if (tokenScore > 0) reasons.push("caption/metadata token match");

    const pageEntities = entitiesForPage(fig.provenance.source, fig.provenance.page);
    const entityBlob = pageEntities.map((e) => `${e.label} ${e.text}`).join(" ");
    const entityScore = scoreTokens(queryTokens, entityBlob);
    score += entityScore * 3;
    if (entityScore > 0) reasons.push("entity label match on page");

    if (fig.isDiagram) {
      score += 0.5;
      reasons.push("diagram figure");
    }

    if (!fig.isPageFallback && fig.provenance.assetPath) {
      score += 1;
      reasons.push("cropped figure asset available");
    }

    for (const hint of hints) {
      if (
        fig.provenance.source === hint.source &&
        fig.provenance.page === hint.page
      ) {
        score += 5;
        reasons.push(`query page hint: ${hint.label}`);
      }
    }

    for (const accepted of acceptedPages ?? []) {
      const src = accepted.source ?? "owner-manual.pdf";
      if (fig.provenance.source === src && fig.provenance.page === accepted.page) {
        score += 3;
        reasons.push(`accepted citation page ${accepted.page}`);
      }
    }

    return { ...fig, score, matchReasons: reasons };
  });

  return ranked
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function bestFigureForQuery(
  query: string,
  acceptedPages?: Array<{ source?: string; page: number }>,
): RankedFigure | null {
  const ranked = rankRelevantFigures(query, loadFigureCandidates(), acceptedPages);
  return ranked[0] ?? null;
}
