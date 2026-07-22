import { EVAL_CASES } from "@/lib/eval/cases";
import { evaluateCase, runToolRegression } from "@/lib/eval/runner";
import type { EvalReport, EvalSummary, EvalCaseResult } from "@/lib/eval/schemas";
import { getCorpusStats } from "@/lib/retrieval/corpus";

function aggregateMetric(
  cases: EvalCaseResult[],
  key: keyof EvalCaseResult["metrics"],
): number {
  const values = cases.map((c) => c.metrics[key]).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function buildSummary(caseResults: EvalCaseResult[]): EvalSummary {
  const passed = caseResults.filter((c) => c.passed).length;
  const total = caseResults.length;

  const byCategory: EvalSummary["byCategory"] = {};
  for (const result of caseResults) {
    if (!byCategory[result.category]) {
      byCategory[result.category] = { total: 0, passed: 0, passRate: 0, averageScore: 0 };
    }
    const bucket = byCategory[result.category]!;
    bucket.total++;
    if (result.passed) bucket.passed++;
    bucket.averageScore += result.score;
  }
  for (const cat of Object.keys(byCategory)) {
    const b = byCategory[cat]!;
    b.passRate = b.total > 0 ? b.passed / b.total : 0;
    b.averageScore = b.total > 0 ? b.averageScore / b.total : 0;
  }

  return {
    totalCases: total,
    passed,
    failed: total - passed,
    passRate: total > 0 ? passed / total : 0,
    averageScore: caseResults.reduce((s, c) => s + c.score, 0) / (total || 1),
    byCategory,
    aggregateMetrics: {
      citationCorrectness: aggregateMetric(caseResults, "citationCorrectness"),
      factualCoverage: aggregateMetric(caseResults, "factualCoverage"),
      unsupportedClaimRate: aggregateMetric(caseResults, "unsupportedClaimRate"),
      artifactSelection: aggregateMetric(caseResults, "artifactSelection"),
      clarificationQuality: aggregateMetric(caseResults, "clarificationQuality"),
      safetyCompliance: aggregateMetric(caseResults, "safetyCompliance"),
      retrievalRecall: aggregateMetric(caseResults, "retrievalRecall"),
      diagnosticRanking: aggregateMetric(caseResults, "diagnosticRanking"),
      responseLatencyMs: null,
      approximateApiCostUsd: null,
    },
  };
}

export interface RunEvalOptions {
  mode?: "deterministic" | "live";
}

export function runEvaluation(options: RunEvalOptions = {}): EvalReport {
  const mode = options.mode ?? "deterministic";
  const caseResults = EVAL_CASES.map((c) => evaluateCase(c));
  const toolRegression = runToolRegression();
  const summary = buildSummary(caseResults);
  const failedCases = caseResults.filter((c) => !c.passed);

  return {
    generatedAt: new Date().toISOString(),
    mode,
    corpusStats: getCorpusStats(),
    summary,
    cases: caseResults,
    failedCases,
    toolRegression,
    liveAgent: {
      enabled: mode === "live",
      casesRun: 0,
      totalLatencyMs: 0,
      totalCostUsd: 0,
    },
  };
}

export function formatEvalMarkdown(report: EvalReport): string {
  const s = report.summary;
  const m = s.aggregateMetrics;

  const lines: string[] = [
    "# WeldPilot Evaluation Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: **${report.mode}** (deterministic checks; LLM-as-judge not required)`,
    "",
    "## Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Total cases | ${s.totalCases} |`,
    `| Passed | ${s.passed} |`,
    `| Failed | ${s.failed} |`,
    `| Pass rate | ${(s.passRate * 100).toFixed(1)}% |`,
    `| Average score | ${(s.averageScore * 100).toFixed(1)}% |`,
    "",
    "## Aggregate measurements",
    "",
    "| # | Measurement | Score |",
    "|---|-------------|-------|",
    `| 1 | Citation correctness | ${(m.citationCorrectness * 100).toFixed(1)}% |`,
    `| 2 | Factual coverage | ${(m.factualCoverage * 100).toFixed(1)}% |`,
    `| 3 | Unsupported claim rate | ${(m.unsupportedClaimRate * 100).toFixed(1)}% |`,
    `| 4 | Correct artifact selection | ${(m.artifactSelection * 100).toFixed(1)}% |`,
    `| 5 | Clarification quality | ${(m.clarificationQuality * 100).toFixed(1)}% |`,
    `| 6 | Safety compliance | ${(m.safetyCompliance * 100).toFixed(1)}% |`,
    `| 7 | Retrieval recall | ${(m.retrievalRecall * 100).toFixed(1)}% |`,
    `| 8 | Diagnostic ranking quality | ${(m.diagnosticRanking * 100).toFixed(1)}% |`,
    `| 9 | Response latency | ${m.responseLatencyMs != null ? `${m.responseLatencyMs.toFixed(0)} ms` : "N/A (deterministic)"} |`,
    `| 10 | Approximate API cost | ${m.approximateApiCostUsd != null ? `$${m.approximateApiCostUsd.toFixed(4)}` : "N/A (deterministic)"} |`,
    "",
    "## By category",
    "",
    "| Category | Total | Passed | Pass rate | Avg score |",
    "|----------|-------|--------|-----------|-----------|",
    ...Object.entries(s.byCategory).map(
      ([cat, b]) =>
        `| ${cat} | ${b.total} | ${b.passed} | ${(b.passRate * 100).toFixed(0)}% | ${(b.averageScore * 100).toFixed(0)}% |`,
    ),
    "",
    "## Tool regression",
    "",
    `Passed **${report.toolRegression.passed}/${report.toolRegression.total}** handler regression cases.`,
    "",
    "## Failed cases",
    "",
  ];

  if (report.failedCases.length === 0) {
    lines.push("_All cases passed._", "");
  } else {
    for (const c of report.failedCases) {
      lines.push(`### ${c.id} — FAIL`, "");
      lines.push(`**Question:** ${c.question}`, "");
      lines.push(`**Category:** ${c.category} · **Score:** ${(c.score * 100).toFixed(0)}%`, "");
      if (c.groundingStatus) lines.push(`**Grounding:** ${c.groundingStatus}`, "");
      if (c.failures.length) {
        lines.push("**Failures:**");
        for (const f of c.failures) lines.push(`- ${f}`);
      }
      lines.push("");
    }
  }

  lines.push("## All case results", "");
  for (const c of report.cases) {
    lines.push(
      `- **${c.id}** (${c.category}): ${c.passed ? "PASS" : "FAIL"} — score ${(c.score * 100).toFixed(0)}%`,
    );
  }
  lines.push("");

  return lines.join("\n");
}
