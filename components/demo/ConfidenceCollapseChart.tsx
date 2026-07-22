"use client";

import type { DiagnosticSession } from "@/lib/detective/schemas";
import { cn } from "@/lib/utils";

interface ConfidenceCollapseChartProps {
  session: DiagnosticSession | null;
  initialUncertainty?: number | null;
  className?: string;
}

export function ConfidenceCollapseChart({
  session,
  initialUncertainty,
  className,
}: ConfidenceCollapseChartProps) {
  if (!session) return null;

  const startUncertainty = initialUncertainty ?? 0.85;
  const currentUncertainty = session.uncertainty;
  const collapse = Math.max(0, startUncertainty - currentUncertainty);
  const confidencePct = Math.round(session.diagnosticConfidence * 100);
  const uncertaintyPct = Math.round(currentUncertainty * 100);

  return (
    <div
      className={cn(
        "rounded-lg border border-garage-border bg-garage-bg p-3",
        className,
      )}
      aria-label="Diagnostic confidence collapse"
    >
      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-garage-muted">
        Confidence collapse
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-garage-muted">Initial uncertainty</p>
          <p className="font-mono text-lg text-amber-300">{Math.round(startUncertainty * 100)}%</p>
          <div className="mt-1 h-2 rounded-full bg-garage-border">
            <div
              className="h-full rounded-full bg-amber-500/60"
              style={{ width: `${startUncertainty * 100}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-garage-muted">After questioning</p>
          <p className="font-mono text-lg text-emerald-300">{uncertaintyPct}%</p>
          <div className="mt-1 h-2 rounded-full bg-garage-border">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all duration-700"
              style={{ width: `${currentUncertainty * 100}%` }}
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-garage-muted">Diagnostic confidence</p>
          <p className="font-mono text-lg text-garage-orange">{confidencePct}%</p>
          <p className="mt-1 text-xs text-garage-muted">
            {collapse > 0.05
              ? `Uncertainty narrowed by ${Math.round(collapse * 100)} pts`
              : "Answer a question to narrow causes"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-garage-muted">
        {session.plausibleCauseCount} plausible cause(s) · {session.questionsAsked.length} question(s)
        asked
      </p>
    </div>
  );
}
