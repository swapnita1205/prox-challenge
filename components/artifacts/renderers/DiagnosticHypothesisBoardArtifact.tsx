"use client";

import type { DiagnosticHypothesisBoardArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";
import { useMicroFlash } from "@/lib/ui/micro-interactions";
import { cn } from "@/lib/utils";

type Spec = z.infer<typeof DiagnosticHypothesisBoardArtifactSchema>;

export function DiagnosticHypothesisBoardArtifact({ spec }: { spec: Spec }) {
  const eliminatedFlash = useMicroFlash("hypothesis_eliminated");
  const confidenceFlash = useMicroFlash("confidence_change");

  const sorted = [...spec.hypotheses]
    .filter((h) => !h.ruledOut)
    .sort((a, b) => b.confidence - a.confidence);

  const ruledOut = spec.hypotheses.filter((h) => h.ruledOut);

  return (
    <ArtifactShell {...spec}>
      {spec.evidenceSummary && (
        <p className="rounded-md border border-garage-border bg-garage-bg px-3 py-2.5 text-sm leading-relaxed text-garage-text">
          {spec.evidenceSummary}
        </p>
      )}

      <ul className="space-y-4" role="list" aria-label="Active hypotheses">
        {sorted.map((h, i) => (
          <li
            key={h.id}
            className={cn(
              "artifact-fade-in space-y-2 rounded-md border border-garage-border/60 bg-garage-bg/40 p-3",
              confidenceFlash && "micro-flash-confidence",
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-garage-text">{h.label}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-garage-orange">
                {Math.round(h.confidence * 100)}%
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-garage-border"
              role="progressbar"
              aria-valuenow={Math.round(h.confidence * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${h.label} confidence`}
            >
              <div
                className="h-full rounded-full bg-garage-orange transition-all duration-500 ease-industrial"
                style={{ width: `${h.confidence * 100}%` }}
              />
            </div>
            {h.evidenceFor.length > 0 && (
              <p className="text-2xs leading-relaxed text-garage-success">
                <span className="font-mono uppercase tracking-wider text-garage-muted">
                  For
                </span>{" "}
                {h.evidenceFor.join(" · ")}
              </p>
            )}
            {h.evidenceAgainst.length > 0 && (
              <p className="text-2xs leading-relaxed text-garage-danger/90">
                <span className="font-mono uppercase tracking-wider text-garage-muted">
                  Against
                </span>{" "}
                {h.evidenceAgainst.join(" · ")}
              </p>
            )}
            {h.missingObservation && (
              <p className="text-2xs text-garage-muted">
                <span className="font-mono uppercase tracking-wider">Need</span>{" "}
                {h.missingObservation}
              </p>
            )}
          </li>
        ))}
      </ul>

      {ruledOut.length > 0 && (
        <div
          className={cn(
            "border-t border-garage-border pt-3",
            eliminatedFlash && "micro-flash-active",
          )}
        >
          <p className="label-caps mb-2">Ruled out</p>
          <ul className="space-y-1.5" role="list" aria-label="Eliminated hypotheses">
            {ruledOut.map((h) => (
              <li
                key={h.id}
                className="hypothesis-eliminated text-sm text-garage-muted line-through decoration-garage-border"
              >
                {h.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ArtifactShell>
  );
}
