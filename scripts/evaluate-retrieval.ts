import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runRetrievalEvaluation } from "@/lib/retrieval/evaluate";

const report = runRetrievalEvaluation();

const outDir = path.join(process.cwd(), "data", "generated");
mkdirSync(outDir, { recursive: true });

const jsonPath = path.join(outDir, "retrieval-evaluation-report.json");
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

const mdPath = path.join(outDir, "retrieval-evaluation-report.md");
const md = [
  "# WeldPilot Retrieval Evaluation Report",
  "",
  `Generated: ${report.generatedAt}`,
  "",
  "## Summary",
  "",
  `| Metric | Value |`,
  `|--------|-------|`,
  `| Total cases | ${report.summary.totalCases} |`,
  `| Passed | ${report.summary.passed} |`,
  `| Failed | ${report.summary.failed} |`,
  `| Pass rate | ${(report.summary.passRate * 100).toFixed(1)}% |`,
  `| Average score | ${(report.summary.averageScore * 100).toFixed(1)}% |`,
  "",
  "## Corpus",
  "",
  `Total documents: **${report.corpusStats.total}**`,
  "",
  "| Corpus type | Count |",
  "|-------------|-------|",
  ...Object.entries(report.corpusStats.byType).map(([k, v]) => `| ${k} | ${v} |`),
  "",
  "## Case Results",
  "",
  ...report.cases.flatMap((c) => [
    `### ${c.id} — ${c.passed ? "PASS" : "FAIL"}`,
    "",
    `**Query:** ${c.query}`,
    "",
    `- Items retrieved: ${c.itemCount}`,
    `- Ambiguities: ${c.ambiguityCount}`,
    `- Corpus types: ${c.corpusTypesFound.join(", ") || "none"}`,
    `- Pages cited: ${c.pagesFound.join(", ") || "none"}`,
    `- Score: ${(c.score * 100).toFixed(0)}%`,
    ...(c.failures.length ? [`- Failures: ${c.failures.join("; ")}`] : []),
    "",
    "Top items:",
    ...c.topItems.map(
      (t) => `- \`${t.id}\` (${t.corpusType}, p${t.page}, score ${t.score.toFixed(3)})`,
    ),
    "",
  ]),
].join("\n");

writeFileSync(mdPath, md);

console.log(`Retrieval evaluation: ${report.summary.passed}/${report.summary.totalCases} passed`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${mdPath}`);

if (report.summary.failed > 0) {
  process.exit(1);
}
