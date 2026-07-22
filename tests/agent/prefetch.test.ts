import { describe, it, expect, beforeEach } from "vitest";
import { createAgentContext } from "@/lib/agent/context";
import {
  formatPrefetchedContext,
  runDeterministicPrefetch,
  summarizePrefetchFinding,
} from "@/lib/agent/prefetch";
import { resetDiagnosticSessions } from "@/lib/agent/diagnostic-session";

describe("runDeterministicPrefetch", () => {
  let ctx: ReturnType<typeof createAgentContext>;

  beforeEach(() => {
    ctx = createAgentContext();
    resetDiagnosticSessions();
  });

  it("resolves calculate_duty_cycle deterministically when process/voltage/amps are all in the message", async () => {
    const outcome = await runDeterministicPrefetch(
      ctx,
      "calculation",
      "What's the MIG duty cycle at 200 amps on 240 volt input?",
    );

    expect(outcome.results.map((r) => r.tool)).toContain("calculate_duty_cycle");
    expect(ctx.artifacts.some((a) => a.type === "duty-cycle-calculator")).toBe(true);
    expect(ctx.citations.some((c) => c.page === 7)).toBe(true);
  });

  it("does not call calculate_duty_cycle when amps cannot be resolved", async () => {
    const outcome = await runDeterministicPrefetch(
      ctx,
      "calculation",
      "How long can I weld before it needs to rest?",
    );

    expect(outcome.results.map((r) => r.tool)).not.toContain("calculate_duty_cycle");
    expect(ctx.artifacts).toHaveLength(0);
  });

  it("resolves find_settings for settings intent using machine state", async () => {
    const outcome = await runDeterministicPrefetch(
      ctx,
      "settings",
      "What settings and wire should I use?",
      {
        mode: "settings",
        process: "mig",
        material: "Mild Steel",
        thickness: "1/8 inch",
        symptoms: [],
        hypotheses: [],
        askedQuestions: [],
        safetyAcknowledged: false,
      },
    );

    expect(outcome.results.map((r) => r.tool)).toContain("find_settings");
    expect(ctx.toolSummaries.some((s) => s.includes("find_settings"))).toBe(true);
  });

  it("runs search_manual for informational/setup/troubleshooting intents", async () => {
    const outcome = await runDeterministicPrefetch(
      ctx,
      "manual_question",
      "Show me the front panel controls and what each knob does.",
    );

    expect(outcome.results.map((r) => r.tool)).toContain("search_manual");
    expect(ctx.citations.length).toBeGreaterThan(0);
  });

  it("does not run search_manual for calculation/settings intents (they use focused deterministic tools instead)", async () => {
    const outcome = await runDeterministicPrefetch(
      ctx,
      "calculation",
      "What's the MIG duty cycle at 200 amps on 240 volt input?",
    );

    expect(outcome.results.map((r) => r.tool)).not.toContain("search_manual");
  });

  it("returns no results for safety_critical (handled earlier by the clarification policy)", async () => {
    const outcome = await runDeterministicPrefetch(
      ctx,
      "safety_critical",
      "How do I bypass the door interlock?",
    );

    expect(outcome.results).toHaveLength(0);
  });

  it("records per-tool phase timings", async () => {
    const outcome = await runDeterministicPrefetch(
      ctx,
      "manual_question",
      "Show me the wire feed mechanism.",
    );

    expect(outcome.phases.length).toBe(outcome.results.length);
    for (const phase of outcome.phases) {
      expect(phase.durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("formatPrefetchedContext", () => {
  it("returns an empty string when nothing was pre-fetched", () => {
    expect(formatPrefetchedContext({ phases: [], results: [] })).toBe("");
  });

  it("embeds tool result JSON and a do-not-repeat instruction", () => {
    const text = formatPrefetchedContext({
      phases: [],
      results: [{ tool: "search_manual", resultText: '{"query":"front panel"}' }],
    });
    expect(text).toContain("search_manual");
    expect(text).toContain("do not call this tool again");
    expect(text).toContain('"query":"front panel"');
  });
});

describe("summarizePrefetchFinding", () => {
  it("prefers duty-cycle summary when calculate_duty_cycle ran", () => {
    const summary = summarizePrefetchFinding({
      phases: [],
      results: [{ tool: "calculate_duty_cycle", resultText: "{}" }],
    });
    expect(summary).toMatch(/duty-cycle/i);
  });

  it("prefers settings summary when find_settings ran", () => {
    const summary = summarizePrefetchFinding({
      phases: [],
      results: [{ tool: "find_settings", resultText: "{}" }],
    });
    expect(summary).toMatch(/settings/i);
  });

  it("falls back to a generic manual summary for search_manual", () => {
    const summary = summarizePrefetchFinding({
      phases: [],
      results: [{ tool: "search_manual", resultText: "{}" }],
    });
    expect(summary).toMatch(/manual/i);
  });

  it("returns null when nothing was found", () => {
    expect(summarizePrefetchFinding({ phases: [], results: [] })).toBeNull();
  });
});
