import Link from "next/link";
import { hasValidApiKey, getEnvError } from "@/lib/env";
import { verifyKnowledgeBundle } from "@/lib/knowledge/bundle";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import packageJson from "@/package.json";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Status — WeldPilot Dev",
  description: "Developer health check for knowledge bundle and API key configuration",
};

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-3 border-b border-garage-border py-3 last:border-b-0">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${ok ? "text-emerald-400" : "text-red-400"}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-garage-text">{label}</p>
        {detail && <p className="mt-0.5 text-sm text-garage-muted">{detail}</p>}
      </div>
    </li>
  );
}

export default function DevHealthPage() {
  const knowledge = verifyKnowledgeBundle();
  const apiKeyConfigured = hasValidApiKey();
  const envError = apiKeyConfigured ? null : getEnvError();
  const overallOk = knowledge.ok && apiKeyConfigured;

  return (
    <main className="min-h-screen bg-garage-bg">
      <header className="border-b border-garage-border px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-garage-orange">
              Developer
            </p>
            <h1 className="text-2xl font-semibold text-garage-text">System status</h1>
            <p className="mt-1 text-sm text-garage-muted">
              WeldPilot v{packageJson.version} — knowledge bundle and API key checks.
            </p>
          </div>
          <Link
            href="/"
            className="rounded border border-garage-border px-4 py-2 font-mono text-xs uppercase text-garage-muted hover:border-garage-orange hover:text-garage-orange"
          >
            ← Home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <div
          className={`mb-6 flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${
            overallOk
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {overallOk ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {overallOk ? "All systems ready." : "Running in a degraded mode — see details below."}
        </div>

        <ul className="rounded-md border border-garage-border bg-garage-panel px-4">
          <StatusRow
            label="Manual knowledge bundle"
            ok={knowledge.ok}
            detail={
              knowledge.ok
                ? `${knowledge.pageCount ?? "?"} manual pages bundled${knowledge.assetSamplePresent ? ", figure assets present" : ""}.`
                : `Missing: ${knowledge.missing.join(", ") || "unknown"}.`
            }
          />
          <StatusRow
            label="ANTHROPIC_API_KEY"
            ok={apiKeyConfigured}
            detail={
              apiKeyConfigured
                ? "Configured — live Claude reasoning is active."
                : (envError ?? "Not configured — the app falls back to placeholder responses.")
            }
          />
        </ul>

        <p className="mt-6 font-mono text-2xs text-garage-muted">
          Machine-readable version: <code>/api/health</code>
        </p>
      </div>
    </main>
  );
}
