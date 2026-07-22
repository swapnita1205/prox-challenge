import { getEnvError, hasValidApiKey } from "@/lib/env";
import { verifyKnowledgeBundle } from "@/lib/knowledge/bundle";

let logged = false;

/** Log startup status once per server process (dev or production). */
export function logStartupStatus(): void {
  if (logged) return;
  logged = true;

  const knowledge = verifyKnowledgeBundle();
  const apiKeyOk = hasValidApiKey();

  console.log("\n── WeldPilot ──────────────────────────────────────");
  console.log(`  Knowledge bundle: ${knowledge.ok ? "OK" : "MISSING FILES"}`);
  if (knowledge.pageCount != null) {
    console.log(`  Manual pages:     ${knowledge.pageCount}`);
  }
  console.log(
    `  API key:          ${apiKeyOk ? "configured" : "not set (placeholder mode)"}`,
  );
  if (!apiKeyOk) {
    const err = getEnvError();
    if (err) console.log(`  Hint:             ${err}`);
    console.log("  Add ANTHROPIC_API_KEY to .env — see .env.example");
  }
  if (!knowledge.ok) {
    console.warn("  Missing bundled data:", knowledge.missing.join(", "));
    console.warn("  Run: npm run ingest  (maintainers only — judges should not need this)");
  }
  console.log("  Health:           GET /api/health");
  console.log("──────────────────────────────────────────────────\n");
}
