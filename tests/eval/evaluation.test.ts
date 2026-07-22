import { describe, it, expect } from "vitest";
import { EVAL_CASES, EVAL_CASE_COUNT, getEvalCasesByCategory } from "@/lib/eval/cases";
import { runEvaluation } from "@/lib/eval/report";
import { runToolRegression } from "@/lib/eval/runner";
import { TOOL_REGRESSION_CASES } from "@/lib/eval/tool-cases";

describe("evaluation dataset", () => {
  it("has at least 40 cases", () => {
    expect(EVAL_CASE_COUNT).toBeGreaterThanOrEqual(40);
  });

  it("covers all required categories", () => {
    const categories = new Set(EVAL_CASES.map((c) => c.category));
    expect(categories.has("technical_factual")).toBe(true);
    expect(categories.has("cross_page")).toBe(true);
    expect(categories.has("duty_cycle")).toBe(true);
    expect(categories.has("polarity")).toBe(true);
    expect(categories.has("machine_setup")).toBe(true);
    expect(categories.has("wire_feed")).toBe(true);
    expect(categories.has("troubleshooting")).toBe(true);
    expect(categories.has("ambiguous")).toBe(true);
    expect(categories.has("visual_content")).toBe(true);
    expect(categories.has("unsafe")).toBe(true);
    expect(categories.has("out_of_scope")).toBe(true);
    expect(categories.has("settings")).toBe(true);
    expect(categories.has("multi_turn_diagnosis")).toBe(true);
  });

  it("includes the three challenge exemplar questions", () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(ids).toContain("challenge-duty-cycle-mig-200a-240v");
    expect(ids).toContain("challenge-flux-porosity-troubleshoot");
    expect(ids).toContain("challenge-tig-polarity-ground-socket");
  });

  it("has unique case ids", () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("evaluation runner", () => {
  it("runs full deterministic evaluation", () => {
    const report = runEvaluation();
    expect(report.cases.length).toBeGreaterThanOrEqual(40);
    expect(report.summary.totalCases).toBe(report.cases.length);
    expect(report.toolRegression.total).toBeGreaterThanOrEqual(19);
    expect(report.generatedAt).toBeTruthy();
  }, 30_000);

  it("challenge duty cycle case passes deterministic checks", () => {
    const report = runEvaluation();
    const duty = report.cases.find((c) => c.id === "challenge-duty-cycle-mig-200a-240v");
    expect(duty).toBeDefined();
    expect(duty!.metrics.citationCorrectness).toBeGreaterThan(0);
    expect(duty!.toolResults.some((t) => t.tool === "calculate_duty_cycle" && t.ok)).toBe(true);
  }, 30_000);
});

describe("tool regression suite", () => {
  it("covers all MCP tool handlers", () => {
    const tools = new Set(TOOL_REGRESSION_CASES.map((c) => c.tool));
    expect(tools.has("search_manual")).toBe(true);
    expect(tools.has("get_manual_page")).toBe(true);
    expect(tools.has("get_figure")).toBe(true);
    expect(tools.has("query_machine_graph")).toBe(true);
    expect(tools.has("calculate_duty_cycle")).toBe(true);
    expect(tools.has("validate_machine_configuration")).toBe(true);
    expect(tools.has("find_settings")).toBe(true);
    expect(tools.has("start_diagnostic_session")).toBe(true);
    expect(tools.has("update_diagnostic_session")).toBe(true);
    expect(tools.has("generate_artifact_spec")).toBe(true);
    expect(tools.has("run_safety_review")).toBe(true);
  });

  it("passes all tool regression cases", () => {
    const result = runToolRegression();
    if (result.failed > 0) {
      const failed = result.cases.filter((c) => !c.passed);
      console.log("Failed tools:", failed);
    }
    expect(result.failed).toBe(0);
  });
});

describe("category distribution", () => {
  it("has multiple cases per major category", () => {
    for (const cat of [
      "technical_factual",
      "troubleshooting",
      "ambiguous",
      "settings",
    ] as const) {
      expect(getEvalCasesByCategory(cat).length).toBeGreaterThanOrEqual(3);
    }
  });
});
