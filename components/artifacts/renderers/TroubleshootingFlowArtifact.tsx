"use client";

import type { TroubleshootingFlowArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";
import { ChevronRight } from "lucide-react";

type Spec = z.infer<typeof TroubleshootingFlowArtifactSchema>;

const KIND_STYLES = {
  question: "border-garage-orange/40 bg-garage-orange/5",
  cause: "border-red-500/30 bg-red-500/5",
  action: "border-blue-500/30 bg-blue-500/5",
  outcome: "border-emerald-500/30 bg-emerald-500/5",
};

export function TroubleshootingFlowArtifact({ spec }: { spec: Spec }) {
  const current = spec.branches.find((b) => b.id === spec.currentNodeId) ?? spec.branches[0];

  return (
    <ArtifactShell {...spec}>
      <div className="space-y-4">
        <div className="rounded-lg border border-garage-orange/40 bg-garage-orange/5 p-4">
          <p className="font-mono text-xs uppercase text-garage-orange">Current question</p>
          <p className="mt-1 text-sm text-garage-text">{spec.currentQuestion}</p>
        </div>

        {spec.observations.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-xs uppercase text-garage-muted">Observations</p>
            <ul className="flex flex-wrap gap-2" role="list">
              {spec.observations.map((o) => (
                <li key={o} className="rounded-full border border-garage-border px-3 py-1 text-xs text-garage-text">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-mono text-xs uppercase text-garage-muted">Branches</p>
          {spec.branches.map((branch) => (
            <div
              key={branch.id}
              className={`flex items-center gap-2 rounded-lg border p-3 transition ${
                KIND_STYLES[branch.kind]
              } ${current?.id === branch.id ? "ring-1 ring-garage-orange" : ""}`}
            >
              <span className="font-mono text-[10px] uppercase text-garage-muted">{branch.kind}</span>
              <span className="flex-1 text-sm text-garage-text">{branch.label}</span>
              {branch.nextId && <ChevronRight className="h-4 w-4 text-garage-muted" />}
            </div>
          ))}
        </div>

        {spec.eliminatedCauses.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-xs uppercase text-garage-muted">Eliminated</p>
            <ul className="space-y-1" role="list">
              {spec.eliminatedCauses.map((c) => (
                <li key={c} className="text-sm text-garage-muted line-through">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {spec.nextRecommendedCheck && (
          <div className="rounded-lg border border-garage-border bg-garage-bg p-3">
            <p className="font-mono text-xs uppercase text-garage-orange">Next check</p>
            <p className="mt-1 text-sm text-garage-text">{spec.nextRecommendedCheck}</p>
          </div>
        )}
      </div>
    </ArtifactShell>
  );
}
