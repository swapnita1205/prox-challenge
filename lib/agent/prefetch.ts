/**
 * Deterministic pre-model retrieval.
 *
 * Runs the same pure tool handlers Claude would otherwise call as separate
 * round trips — BEFORE the model is invoked — so the first (ideally only)
 * model turn already has the evidence it needs. This is the "parallel
 * retrieval" stage of:
 *
 *   deterministic router -> parallel retrieval -> one Claude call ->
 *   deterministic artifact rendering -> response
 *
 * Each task writes into the same AgentContext (citations/artifacts/tool
 * summaries) that the MCP tool handlers use, so grounding and telemetry
 * behave identically whether a fact was fetched here or by a live tool
 * call. Tasks only fire when the relevant parameters are confidently
 * resolvable from the message/machine state — anything ambiguous is left
 * for the model to resolve dynamically via the normal MCP tools, so this
 * is a pure latency optimization with no effect on what gets answered.
 */
import type { AgentContext } from "@/lib/agent/context";
import {
  handleCalculateDutyCycle,
  handleFindSettings,
  handleSearchManual,
} from "@/lib/agent/tools/handlers";
import type { AgentIntent } from "@/lib/agent/schemas";
import type { MachineState } from "@/lib/schemas/conversation";
import { extractQueryDimensions } from "@/lib/retrieval/dimensions";

export interface PrefetchPhase {
  tool: string;
  category: "retrieval" | "graph" | "settings" | "duty_cycle";
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface PrefetchOutcome {
  phases: PrefetchPhase[];
  /** Compact tool-result JSON strings, ready to embed in the prompt as
   * "already retrieved" evidence. */
  results: Array<{ tool: string; resultText: string }>;
}

/** Intents where a manual search is (almost) always the first useful step. */
const SEARCH_INTENTS: ReadonlySet<AgentIntent> = new Set([
  "manual_question",
  "part_identification",
  "setup",
  "visual_diagnosis",
  "troubleshooting",
]);

const VALID_PROCESSES = new Set(["mig", "tig", "stick", "flux"]);

function resolveProcess(
  dims: ReturnType<typeof extractQueryDimensions>,
  machineState?: MachineState,
): "mig" | "tig" | "stick" | "flux" | undefined {
  const candidate = machineState?.process ?? dims.processes[0];
  return candidate && VALID_PROCESSES.has(candidate)
    ? (candidate as "mig" | "tig" | "stick" | "flux")
    : undefined;
}

function resolveVoltage(
  dims: ReturnType<typeof extractQueryDimensions>,
  machineState?: MachineState,
): 120 | 240 | undefined {
  return machineState?.inputVoltage ?? dims.inputVoltage;
}

function textOf(result: { content: Array<{ type: "text"; text: string }> }): string {
  return result.content[0]?.text ?? "";
}

/**
 * Runs every applicable deterministic task and resolves once all of them
 * have completed. Tasks are independent of one another (none reads another
 * task's output) so they are dispatched together via Promise.all rather
 * than one-at-a-time — the moment any task gains real async I/O this
 * already parallelizes correctly instead of needing a rewrite.
 */
export async function runDeterministicPrefetch(
  ctx: AgentContext,
  intent: AgentIntent,
  message: string,
  machineState?: MachineState,
): Promise<PrefetchOutcome> {
  const dims = extractQueryDimensions(message);
  const tasks: Array<() => { tool: string; category: PrefetchPhase["category"]; resultText: string }> = [];

  if (SEARCH_INTENTS.has(intent)) {
    tasks.push(() => ({
      tool: "search_manual",
      category: "retrieval",
      resultText: textOf(handleSearchManual(ctx, { query: message, limit: 5 })),
    }));
  }

  if (intent === "calculation") {
    const process = resolveProcess(dims, machineState);
    const inputVoltage = resolveVoltage(dims, machineState);
    const amps = dims.outputAmps;
    if (process && inputVoltage && typeof amps === "number") {
      tasks.push(() => ({
        tool: "calculate_duty_cycle",
        category: "duty_cycle",
        resultText: textOf(handleCalculateDutyCycle(ctx, { process, inputVoltage, amps })),
      }));
    }
  }

  if (intent === "settings") {
    tasks.push(() => ({
      tool: "find_settings",
      category: "settings",
      resultText: textOf(
        handleFindSettings(ctx, {
          query: message,
          process: machineState?.process,
          material: machineState?.material,
          thickness: machineState?.thickness,
          inputVoltage: machineState?.inputVoltage,
        }),
      ),
    }));
  }

  if (tasks.length === 0) {
    return { phases: [], results: [] };
  }

  const requestStart = Date.now();
  const settled = await Promise.all(
    tasks.map(async (task) => {
      const t0 = Date.now();
      const { tool, category, resultText } = task();
      const t1 = Date.now();
      const phase: PrefetchPhase = {
        tool,
        category,
        startMs: t0 - requestStart,
        endMs: t1 - requestStart,
        durationMs: t1 - t0,
      };
      return { phase, tool, resultText };
    }),
  );

  return {
    phases: settled.map((s) => s.phase),
    results: settled.map((s) => ({ tool: s.tool, resultText: s.resultText })),
  };
}

/** Compact "already retrieved" block injected into the user prompt so the
 * model does not need a tool round trip to see this evidence. */
export function formatPrefetchedContext(outcome: PrefetchOutcome): string {
  if (outcome.results.length === 0) return "";
  const lines = outcome.results.map(
    (r) => `- ${r.tool} result (do not call this tool again with the same input): ${r.resultText}`,
  );
  return `\n\nAlready retrieved deterministically before you were invoked — use this evidence directly:\n${lines.join("\n")}`;
}

/** Short, user-facing summary of what pre-fetch found — used for the early
 * "Found ..." streaming status line shown within ~2 seconds. */
export function summarizePrefetchFinding(outcome: PrefetchOutcome): string | null {
  const tools = new Set(outcome.results.map((r) => r.tool));
  if (tools.has("calculate_duty_cycle")) {
    return "Found the duty-cycle table and setup guide.";
  }
  if (tools.has("find_settings")) {
    return "Found the settings chart and setup guide.";
  }
  if (tools.has("search_manual")) {
    return "Found relevant manual sections.";
  }
  return null;
}
