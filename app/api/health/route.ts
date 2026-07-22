import { hasValidApiKey, getEnvError } from "@/lib/env";
import { verifyKnowledgeBundle } from "@/lib/knowledge/bundle";
import packageJson from "@/package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const knowledge = verifyKnowledgeBundle();
  const apiKeyConfigured = hasValidApiKey();
  const envError = apiKeyConfigured ? null : getEnvError();

  const status = knowledge.ok ? "ok" : "degraded";

  return Response.json(
    {
      status,
      service: "weldpilot",
      version: packageJson.version,
      apiKeyConfigured,
      envError,
      knowledge: {
        bundled: knowledge.ok,
        pageCount: knowledge.pageCount,
        assetSamplePresent: knowledge.assetSamplePresent,
        missing: knowledge.missing,
      },
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 },
  );
}
