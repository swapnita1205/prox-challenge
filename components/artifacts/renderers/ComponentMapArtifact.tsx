import type { ComponentMapArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";

type Spec = z.infer<typeof ComponentMapArtifactSchema>;

export function ComponentMapArtifact({ spec }: { spec: Spec }) {
  return (
    <ArtifactShell {...spec}>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-garage-border bg-[#2a2a2e]">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xs uppercase tracking-widest text-garage-muted/50">
            {spec.view.replace("_", " ")}
          </span>
        </div>
        {spec.components.map((comp) => (
          <button
            key={comp.id}
            type="button"
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded border px-2 py-1 text-left transition hover:scale-105 ${
              comp.highlighted
                ? "border-garage-orange bg-garage-orange/20 text-garage-orange"
                : "border-garage-border bg-garage-panel/90 text-garage-text"
            }`}
            style={{ left: `${comp.x}%`, top: `${comp.y}%` }}
            title={comp.description}
          >
            <span className="block font-mono text-[10px] sm:text-xs">{comp.name}</span>
          </button>
        ))}
      </div>
      {spec.components.some((c) => c.description) && (
        <ul className="mt-2 space-y-1 text-xs text-garage-muted" role="list">
          {spec.components
            .filter((c) => c.description)
            .map((c) => (
              <li key={c.id}>
                <strong className="text-garage-text">{c.name}:</strong> {c.description}
              </li>
            ))}
        </ul>
      )}
    </ArtifactShell>
  );
}
