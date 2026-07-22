import { describe, it, expect, beforeEach } from "vitest";
import { createAgentContext } from "@/lib/agent/context";
import {
  handleCalculateDutyCycle,
  handleSearchManual,
  handleGenerateArtifactSpec,
  handleRunSafetyReview,
  handleStartDiagnosticSession,
} from "@/lib/agent/tools/handlers";
import { resetDiagnosticSessions } from "@/lib/agent/diagnostic-session";

describe("agent tools", () => {
  let ctx: ReturnType<typeof createAgentContext>;

  beforeEach(() => {
    ctx = createAgentContext();
    resetDiagnosticSessions();
  });

  it("search_manual returns citations without hardcoded answers", () => {
    const result = handleSearchManual(ctx, {
      query: "MIG duty cycle 200 amps 240V",
      limit: 5,
    });
    const text = result.content[0]?.text ?? "";
    expect(text).toMatch(/duty_cycle|duty cycle/i);
    expect(ctx.citations.length).toBeGreaterThan(0);
    expect(ctx.citations.some((c) => c.page === 7)).toBe(true);
  });

  it("calculate_duty_cycle uses deterministic manual data", () => {
    const result = handleCalculateDutyCycle(ctx, {
      process: "mig",
      inputVoltage: 240,
      amps: 200,
    });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      applicableDutyPercent: number;
      citation: { page: number };
    };
    expect(parsed.applicableDutyPercent).toBe(25);
    expect(parsed.citation.page).toBe(7);
  });

  it("generate_artifact_spec validates typed artifacts", () => {
    const result = handleGenerateArtifactSpec(ctx, {
      spec: {
        type: "duty-cycle-calculator",
        title: "Duty Cycle Test",
        process: "mig",
        voltage: 240,
        defaultAmps: 200,
        citations: [],
      },
    });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as { ok: boolean };
    expect(parsed.ok).toBe(true);
    expect(ctx.artifacts).toHaveLength(1);
  });

  it("run_safety_review returns warnings when arc mentioned", () => {
    const result = handleRunSafetyReview(ctx, {
      mentionsArc: true,
      safetyAcknowledged: false,
    });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      passed: boolean;
      safetyNotices: string[];
    };
    expect(parsed.passed).toBe(true);
    expect(parsed.safetyNotices.length).toBeGreaterThan(0);
  });

  it("run_safety_review blocks interlock bypass in procedural action", () => {
    const result = handleRunSafetyReview(ctx, {
      proceduralAction: "bypass the door interlock while welding",
      safetyAcknowledged: true,
    });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      passed: boolean;
      safetyNotices: string[];
    };
    expect(parsed.passed).toBe(false);
    expect(parsed.safetyNotices.some((n) => /interlock/i.test(n))).toBe(true);
  });

  it("start_diagnostic_session creates ranked hypotheses", () => {
    const result = handleStartDiagnosticSession(ctx, {
      primarySymptom: "porosity",
    });
    const parsed = JSON.parse(result.content[0]?.text ?? "{}") as {
      diagnosticState: { hypotheses: Array<{ label: string }> };
    };
    expect(parsed.diagnosticState.hypotheses.length).toBeGreaterThan(1);
  });
});
