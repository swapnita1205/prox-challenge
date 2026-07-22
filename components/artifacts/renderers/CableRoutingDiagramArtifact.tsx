import type { CableRoutingDiagramArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";

type Spec = z.infer<typeof CableRoutingDiagramArtifactSchema>;

const COLORS = {
  orange: "#e85d04",
  blue: "#4a9eff",
  neutral: "#9a9aa3",
};

export function CableRoutingDiagramArtifact({ spec }: { spec: Spec }) {
  return (
    <ArtifactShell {...spec}>
      <ul className="space-y-3" role="list">
        {spec.routes.map((route, i) => (
          <li
            key={route.id}
            className="artifact-fade-in rounded-lg border border-garage-border bg-garage-bg p-3"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS[route.color ?? "neutral"] }}
                aria-hidden
              />
              <span className="font-mono text-sm font-medium text-garage-text">{route.cable}</span>
            </div>
            <p className="mt-1 text-sm text-garage-muted">
              {route.from} → {route.to}
              {route.socket ? ` (${route.socket} socket)` : ""}
            </p>
          </li>
        ))}
      </ul>
    </ArtifactShell>
  );
}
