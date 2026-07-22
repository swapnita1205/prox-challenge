import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runEvaluation, formatEvalMarkdown } from "@/lib/eval/report";
import { EVAL_CASE_COUNT } from "@/lib/eval/cases";

const args = process.argv.slice(2);
const live = args.includes("--live");

const report = runEvaluation({ mode: live ? "live" : "deterministic" });

const outDir = path.join(process.cwd(), "data", "generated");
mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, "evaluation-report.json");
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const mdPath = path.join(outDir, "evaluation-report.md");
writeFileSync(mdPath, formatEvalMarkdown(report));

console.log("");
console.log("WeldPilot Evaluation");
console.log("====================");
console.log(`Dataset: ${EVAL_CASE_COUNT} cases`);
console.log(
  `Cases: ${report.summary.passed}/${report.summary.totalCases} passed (${(report.summary.passRate * 100).toFixed(1)}%)`,
);
console.log(
  `Tools: ${report.toolRegression.passed}/${report.toolRegression.total} passed`,
);
console.log("");
console.log("Aggregate metrics:");
const m = report.summary.aggregateMetrics;
console.log(`  1. Citation correctness     ${(m.citationCorrectness * 100).toFixed(1)}%`);
console.log(`  2. Factual coverage         ${(m.factualCoverage * 100).toFixed(1)}%`);
console.log(`  3. Unsupported claim rate   ${(m.unsupportedClaimRate * 100).toFixed(1)}%`);
console.log(`  4. Artifact selection       ${(m.artifactSelection * 100).toFixed(1)}%`);
console.log(`  5. Clarification quality    ${(m.clarificationQuality * 100).toFixed(1)}%`);
console.log(`  6. Safety compliance        ${(m.safetyCompliance * 100).toFixed(1)}%`);
console.log(`  7. Retrieval recall         ${(m.retrievalRecall * 100).toFixed(1)}%`);
console.log(`  8. Diagnostic ranking       ${(m.diagnosticRanking * 100).toFixed(1)}%`);
console.log(`  9. Response latency         N/A (deterministic mode)`);
console.log(` 10. API cost                 N/A (deterministic mode)`);
console.log("");
console.log(`JSON:     ${jsonPath}`);
console.log(`Markdown: ${mdPath}`);

if (report.summary.failed > 0) {
  console.log(`\nNote: ${report.summary.failed} evaluation case(s) failed — see report for details.`);
}

if (report.toolRegression.failed > 0) {
  console.log("");
  console.log("Failed tool regressions:");
  for (const t of report.toolRegression.cases.filter((c) => !c.passed)) {
    console.log(`  - ${t.id}: ${t.failures.join("; ")}`);
  }
}

const exitCode = report.toolRegression.failed > 0 ? 1 : 0;
process.exit(exitCode);
