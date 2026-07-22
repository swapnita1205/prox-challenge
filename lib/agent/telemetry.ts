import type { StreamEvent } from "@/lib/schemas/api";
import type { AgentResponse } from "@/lib/agent/schemas";
import type { GroundingResult } from "@/lib/grounding/schemas";
import type { Citation } from "@/lib/schemas/conversation";
import type { ArtifactSpec } from "@/lib/schemas/artifacts";

export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  /** Wall-clock tool handler duration when measured (ms). */
  durationMs?: number;
}

export interface TokenUsage {
  /** Uncached input tokens (SDK `input_tokens`). */
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface ModelInvocationRecord {
  model: string;
  /** Approximate turn index within the SDK session (1-based). */
  turn: number;
  startMs: number;
  endMs: number;
  latencyMs: number;
  stopReason: string | null;
}

/**
 * One stage of the per-request execution waterfall. Stages are ordered by
 * `startMs` and are the union of: deterministic routing, deterministic
 * pre-fetch (retrieval / graph / figure / settings), each Claude model
 * turn, grounding, and stream rendering.
 */
export interface WaterfallPhase {
  phase:
    | "routing"
    | "prefetch_retrieval"
    | "prefetch_graph"
    | "prefetch_settings"
    | "prefetch_duty_cycle"
    | "claude"
    | "tool_call"
    | "artifact_generation"
    | "safety"
    | "grounding"
    | "rendering";
  label: string;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface AgentRunTelemetry {
  latencyMs: number;
  sdkDurationMs: number | null;
  /** Time from run start to first assistant/tool_progress signal (ms). */
  timeToFirstTokenMs: number | null;
  model: string | null;
  modelInvocations: ModelInvocationRecord[];
  toolCalls: ToolCallRecord[];
  toolSummaries: string[];
  toolExecutionMs: number;
  retrievalMs: number;
  safetyReviewMs: number;
  artifactGenerationMs: number;
  groundingMs: number;
  /** Deterministic classifyIntent + ClarificationPolicy time (ms). */
  routingMs: number;
  /** Wall time of the deterministic pre-fetch stage (ms). */
  prefetchMs: number;
  /** Time spent building stream events (chunking, artifact/citation/grounding events) (ms). */
  renderingMs: number;
  /** Ordered execution waterfall for this request. */
  waterfall: WaterfallPhase[];
  citations: Citation[];
  artifactType: string | null;
  artifactValid: boolean;
  groundingStatus: GroundingResult["status"] | null;
  groundingAllowed: boolean | null;
  confidence: AgentResponse["confidence"] | null;
  clarifyingQuestion: string | null;
  safetyOutcome: "blocked" | "warned" | "allowed" | "unknown";
  parseFallback: boolean;
  recoveryNotes: string[];
  usage: TokenUsage | null;
  /** Uncached + cache create + cache read (prompt-side volume). */
  effectiveInputTokens: number | null;
  totalCostUsd: number | null;
  numTurns: number | null;
  retryCount: number;
  stopReason: string | null;
  streamEventTypes: string[];
  textLength: number;
  error: string | null;
}

export interface InstrumentedAgentResult {
  events: StreamEvent[];
  telemetry: AgentRunTelemetry;
  response: AgentResponse | null;
  grounding: GroundingResult | null;
  artifact: ArtifactSpec | null;
}

export function shortToolName(raw: string): string {
  const parts = raw.split("__");
  return parts[parts.length - 1] ?? raw;
}

export function extractToolCallsFromAssistantContent(
  content: unknown,
): ToolCallRecord[] {
  if (!Array.isArray(content)) return [];
  const calls: ToolCallRecord[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      "type" in block &&
      (block as { type: string }).type === "tool_use"
    ) {
      const b = block as {
        name?: string;
        input?: unknown;
      };
      const name = shortToolName(b.name ?? "unknown");
      const args =
        b.input && typeof b.input === "object" && !Array.isArray(b.input)
          ? (b.input as Record<string, unknown>)
          : {};
      calls.push({ name, arguments: args });
    }
  }
  return calls;
}

export function safetyOutcomeFromGrounding(
  grounding: GroundingResult | null,
): AgentRunTelemetry["safetyOutcome"] {
  if (!grounding) return "unknown";
  if (grounding.status === "blocked_for_safety" || !grounding.allowedToShow) {
    return "blocked";
  }
  if (grounding.warnings.length > 0) return "warned";
  return "allowed";
}

/** Prompt-side tokens: uncached input + cache write + cache read. */
export function effectiveInputTokens(usage: TokenUsage | null | undefined): number | null {
  if (!usage) return null;
  return (
    usage.inputTokens +
    usage.cacheCreationInputTokens +
    usage.cacheReadInputTokens
  );
}

const PREFETCH_PHASE_LABEL: Record<string, WaterfallPhase["phase"]> = {
  retrieval: "prefetch_retrieval",
  graph: "prefetch_graph",
  settings: "prefetch_settings",
  duty_cycle: "prefetch_duty_cycle",
};

/** Assembles the ordered per-request waterfall from timing captured across
 * routing, prefetch, each Claude turn, artifact/safety tool time, grounding,
 * and rendering. All inputs are relative to the same request-start clock. */
export function buildWaterfall(args: {
  routingMs: number;
  prefetchPhases: Array<{
    tool: string;
    category: string;
    startMs: number;
    endMs: number;
    durationMs: number;
  }>;
  modelInvocations: ModelInvocationRecord[];
  safetyReviewMs: number;
  artifactGenerationMs: number;
  groundingMs: number;
  renderingMs: number;
}): WaterfallPhase[] {
  const phases: WaterfallPhase[] = [];
  let cursor = 0;

  phases.push({
    phase: "routing",
    label: "Deterministic routing (intent + clarification policy)",
    startMs: 0,
    endMs: args.routingMs,
    durationMs: args.routingMs,
  });
  cursor = args.routingMs;

  for (const p of args.prefetchPhases) {
    phases.push({
      phase: PREFETCH_PHASE_LABEL[p.category] ?? "prefetch_retrieval",
      label: `Pre-fetch: ${p.tool}`,
      startMs: cursor + p.startMs,
      endMs: cursor + p.endMs,
      durationMs: p.durationMs,
    });
  }
  if (args.prefetchPhases.length > 0) {
    cursor += Math.max(...args.prefetchPhases.map((p) => p.endMs));
  }

  for (const inv of args.modelInvocations) {
    phases.push({
      phase: "claude",
      label: `Claude reasoning turn ${inv.turn}`,
      startMs: cursor + inv.startMs,
      endMs: cursor + inv.endMs,
      durationMs: inv.latencyMs,
    });
  }
  if (args.modelInvocations.length > 0) {
    cursor += Math.max(...args.modelInvocations.map((inv) => inv.endMs));
  }

  if (args.safetyReviewMs > 0) {
    phases.push({
      phase: "safety",
      label: "Safety review",
      startMs: cursor,
      endMs: cursor + args.safetyReviewMs,
      durationMs: args.safetyReviewMs,
    });
  }

  if (args.artifactGenerationMs > 0) {
    phases.push({
      phase: "artifact_generation",
      label: "Artifact generation (deterministic)",
      startMs: cursor,
      endMs: cursor + args.artifactGenerationMs,
      durationMs: args.artifactGenerationMs,
    });
  }

  phases.push({
    phase: "grounding",
    label: "Grounding evaluation",
    startMs: cursor,
    endMs: cursor + args.groundingMs,
    durationMs: args.groundingMs,
  });
  cursor += args.groundingMs;

  phases.push({
    phase: "rendering",
    label: "Stream event rendering",
    startMs: cursor,
    endMs: cursor + args.renderingMs,
    durationMs: args.renderingMs,
  });

  return phases;
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}
