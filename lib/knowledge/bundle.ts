import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Required bundled knowledge files (committed for judges — no ingest step). */
const REQUIRED_JSON = [
  "chunks.json",
  "pages.json",
  "duty-cycle.json",
  "knowledge-graph.json",
  "asset-manifest.json",
] as const;

const SAMPLE_ASSET = join(
  "public",
  "manual-assets",
  "owner-manual",
  "p01.png",
);

function projectRoot(): string {
  return process.cwd();
}

export interface KnowledgeBundleStatus {
  ok: boolean;
  missing: string[];
  pageCount: number | null;
  assetSamplePresent: boolean;
}

export function verifyKnowledgeBundle(): KnowledgeBundleStatus {
  const root = projectRoot();
  const missing: string[] = [];

  for (const file of REQUIRED_JSON) {
    const path = join(root, "data", "generated", file);
    if (!existsSync(path)) {
      missing.push(`data/generated/${file}`);
    }
  }

  const assetSamplePresent = existsSync(join(root, SAMPLE_ASSET));
  if (!assetSamplePresent) {
    missing.push(SAMPLE_ASSET.replace(/\\/g, "/"));
  }

  let pageCount: number | null = null;
  const pagesPath = join(root, "data", "generated", "pages.json");
  if (existsSync(pagesPath)) {
    try {
      const parsed = JSON.parse(readFileSync(pagesPath, "utf8")) as
        | unknown[]
        | { pages?: unknown[] };
      if (Array.isArray(parsed)) {
        pageCount = parsed.length;
      } else if (Array.isArray(parsed.pages)) {
        pageCount = parsed.pages.length;
      }
    } catch {
      pageCount = null;
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    pageCount,
    assetSamplePresent,
  };
}
