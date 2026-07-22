import type { Citation } from "@/lib/schemas/conversation";
import type { ArtifactSpec } from "@/lib/schemas/artifacts";

export interface ToolTimingBucket {
  retrievalMs: number;
  safetyReviewMs: number;
  artifactGenerationMs: number;
  toolExecutionMs: number;
  byTool: Record<string, number>;
}

export interface AgentContext {
  citations: Citation[];
  artifacts: ArtifactSpec[];
  toolSummaries: string[];
  /** In-request cache for identical search_manual queries. */
  retrievalCache: Map<string, unknown>;
  /** In-request cache for identical query_machine_graph lookups. */
  graphCache: Map<string, unknown>;
  /** In-request cache for identical get_figure lookups. */
  figureCache: Map<string, unknown>;
  /** In-request cache for identical find_settings lookups. */
  settingsCache: Map<string, unknown>;
  timings: ToolTimingBucket;
  /** Cap expensive page fetches within one agent request. */
  pageFetchCount: number;
  maxPageFetches: number;
}

export function createAgentContext(): AgentContext {
  return {
    citations: [],
    artifacts: [],
    toolSummaries: [],
    retrievalCache: new Map(),
    graphCache: new Map(),
    figureCache: new Map(),
    settingsCache: new Map(),
    timings: {
      retrievalMs: 0,
      safetyReviewMs: 0,
      artifactGenerationMs: 0,
      toolExecutionMs: 0,
      byTool: {},
    },
    pageFetchCount: 0,
    maxPageFetches: 1,
  };
}

/** Citation cache: de-duplicates by source+page+section so repeated tool
 * calls within one request never grow the citation list with the same
 * evidence twice. */
export function addCitations(ctx: AgentContext, citations: Citation[]): void {
  const seen = new Set(ctx.citations.map((c) => `${c.source}:${c.page}:${c.section ?? ""}`));
  for (const c of citations) {
    const key = `${c.source}:${c.page}:${c.section ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      ctx.citations.push(c);
    }
  }
}

export function addArtifact(ctx: AgentContext, spec: ArtifactSpec): void {
  ctx.artifacts.push(spec);
}

export function addToolSummary(ctx: AgentContext, summary: string): void {
  ctx.toolSummaries.push(summary);
}

export function recordToolTiming(
  ctx: AgentContext,
  toolName: string,
  durationMs: number,
  category: "retrieval" | "safety" | "artifact" | "other" = "other",
): void {
  ctx.timings.toolExecutionMs += durationMs;
  ctx.timings.byTool[toolName] = (ctx.timings.byTool[toolName] ?? 0) + durationMs;
  if (category === "retrieval") ctx.timings.retrievalMs += durationMs;
  if (category === "safety") ctx.timings.safetyReviewMs += durationMs;
  if (category === "artifact") ctx.timings.artifactGenerationMs += durationMs;
}
