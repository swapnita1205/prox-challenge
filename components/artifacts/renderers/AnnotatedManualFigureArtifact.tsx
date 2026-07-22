"use client";

import { useState } from "react";
import type { AnnotatedManualFigureArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";
import { ManualFigureImage } from "@/components/artifacts/shared/ManualFigureImage";
import { resolveFigureImagePath } from "@/lib/visual";
import { cn } from "@/lib/utils";

type Spec = z.infer<typeof AnnotatedManualFigureArtifactSchema>;

export function AnnotatedManualFigureArtifact({ spec }: { spec: Spec }) {
  const assetPath = resolveFigureImagePath(spec);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [runtimeNote, setRuntimeNote] = useState<string | null>(null);
  const note = runtimeNote ?? spec.fallbackNote;

  function activateRegion(id: string | null) {
    setActiveRegion((prev) => (prev === id ? null : id));
  }

  return (
    <ArtifactShell {...spec}>
      <figure className="overflow-hidden rounded-md border border-garage-border bg-garage-bg shadow-panel">
        <div className="relative aspect-[4/3] w-full">
          <ManualFigureImage
            assetPath={assetPath}
            source={spec.source}
            page={spec.page}
            alt={spec.caption}
            className="object-contain p-2 sm:p-3"
            fallbackNote={spec.fallbackNote}
            onFallbackNote={setRuntimeNote}
          />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="group"
            aria-label="Annotated highlight regions"
          >
            {spec.regions.map((region) => {
              const isActive = activeRegion === region.id;
              return (
                <g key={region.id}>
                  <rect
                    x={region.x}
                    y={region.y}
                    width={region.width}
                    height={region.height}
                    fill={isActive ? "rgba(232, 93, 4, 0.28)" : "rgba(232, 93, 4, 0.12)"}
                    stroke="#e85d04"
                    strokeWidth={isActive ? "0.55" : "0.35"}
                    className={cn(isActive && "region-highlight")}
                    role="button"
                    tabIndex={0}
                    aria-label={region.label ?? region.description ?? `Region ${region.id}`}
                    aria-pressed={isActive}
                    style={{ cursor: "pointer", pointerEvents: "auto" }}
                    onClick={() => activateRegion(region.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        activateRegion(region.id);
                      }
                    }}
                  />
                </g>
              );
            })}
            {spec.callouts.map((c, i) => (
              <g key={c.id} aria-hidden>
                <circle cx={c.x} cy={c.y} r="1.8" fill="#e85d04" />
                <text
                  x={c.x + 2.2}
                  y={c.y + 0.7}
                  fill="#e85d04"
                  fontSize="2.2"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
        <figcaption className="border-t border-garage-border px-3 py-2">
          {note && (
            <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
              {note}
            </p>
          )}
          <p className="text-sm text-garage-text">{spec.caption}</p>
          <p className="mt-1 text-2xs text-garage-muted">
            Tap or focus a callout / region to highlight it on the figure.
          </p>
        </figcaption>
      </figure>

      <ul className="grid gap-2 sm:grid-cols-2" role="list">
        {spec.callouts.map((c, i) => {
          const region = spec.regions.find((r) => r.id === c.targetRegionId);
          const targetId = c.targetRegionId ?? region?.id ?? null;
          const isActive = activeRegion === targetId;
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={isActive}
                aria-describedby={region ? `region-desc-${region.id}` : undefined}
                onClick={() => activateRegion(targetId)}
                onFocus={() => setActiveRegion(targetId)}
                className={cn(
                  "w-full rounded-md border p-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garage-orange",
                  isActive
                    ? "border-garage-orange/50 bg-garage-orange/5"
                    : "border-garage-border bg-garage-bg hover:border-garage-border-bright",
                )}
              >
                <span className="font-mono text-xs font-semibold text-garage-orange">
                  {i + 1}.
                </span>{" "}
                <span className="font-medium text-garage-text">{c.label}</span>
                {region?.description && (
                  <p
                    id={`region-desc-${region.id}`}
                    className="mt-1 text-2xs leading-relaxed text-garage-muted"
                  >
                    {region.description}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </ArtifactShell>
  );
}
