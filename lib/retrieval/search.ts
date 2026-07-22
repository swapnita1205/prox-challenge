import chunksData from "@/data/generated/chunks.json";
import dutyCycleData from "@/data/generated/duty-cycle.json";
import pagesData from "@/data/generated/pages.json";
import type { Citation } from "@/lib/schemas/conversation";

const chunks = chunksData.chunks;

type PageRecord = {
  source: string;
  page: number;
  text: string;
  renderAssetPath?: string;
};

const pageRenderIndex = new Map<string, string>();
for (const p of pagesData as PageRecord[]) {
  if (p.renderAssetPath) {
    pageRenderIndex.set(`${p.source}:${p.page}`, p.renderAssetPath);
  }
}

export interface ManualChunk {
  id: string;
  source: string;
  page: number;
  section?: string;
  text: string;
  topics: string[];
  processes: string[];
}

export interface DutyCycleEntry {
  id: string;
  process: string | null;
  inputVoltage: number | null;
  dutyPercent: number;
  amps: number;
  continuous?: boolean;
  needsReview?: boolean;
  provenance: {
    source: string;
    page: number;
    confidence: number;
  };
}

export interface SearchResult {
  chunk: ManualChunk;
  score: number;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

export function searchManual(
  query: string,
  options?: { process?: string; limit?: number },
): SearchResult[] {
  const tokens = tokenize(query);
  const limit = options?.limit ?? 5;
  const allChunks = chunks as ManualChunk[];

  const scored = allChunks
    .filter((c) => !options?.process || c.processes.includes(options.process))
    .map((chunk) => {
      const haystack = `${chunk.text} ${chunk.section ?? ""}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 1;
      }
      return { chunk, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

export function chunkToCitation(chunk: ManualChunk): Citation {
  const slug = chunk.source.replace(".pdf", "");
  return {
    source: chunk.source,
    page: chunk.page,
    section: chunk.section,
    excerpt: chunk.text.slice(0, 200),
    assetId: `manual-assets/${slug}/p${String(chunk.page).padStart(2, "0")}.png`,
  };
}

export function getDutyCycleTable(): DutyCycleEntry[] {
  return dutyCycleData as DutyCycleEntry[];
}

export function getSpecifications() {
  const pages = pagesData as PageRecord[];
  const specPage = pages.find(
    (p) => p.source === "owner-manual.pdf" && p.page === 7,
  );
  return {
    model: "Vulcan OmniPro 220",
    itemNumber: "57812",
    processes: ["mig", "flux", "tig", "stick"],
    inputVoltages: [120, 240],
    source: "owner-manual.pdf",
    page: 7,
    excerpt: specPage?.text?.slice(0, 500),
  };
}

export function getPageRenderPath(source: string, page: number): string {
  const key = `${source}:${page}`;
  const fromIndex = pageRenderIndex.get(key);
  if (fromIndex) return fromIndex;
  const slug = source.replace(".pdf", "");
  return `/manual-assets/${slug}/p${String(page).padStart(2, "0")}.png`;
}
