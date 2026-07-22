"use client";

import { useState } from "react";
import type { ManualFigureArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";
import { ManualFigureImage } from "@/components/artifacts/shared/ManualFigureImage";
import { resolveFigureImagePath } from "@/lib/visual";

type Spec = z.infer<typeof ManualFigureArtifactSchema>;

export function ManualFigureArtifact({ spec }: { spec: Spec }) {
  const assetPath = resolveFigureImagePath(spec);
  const [runtimeNote, setRuntimeNote] = useState<string | null>(null);
  const note = runtimeNote ?? spec.fallbackNote;

  return (
    <ArtifactShell {...spec}>
      <figure className="overflow-hidden rounded-md border border-garage-border bg-garage-bg shadow-panel">
        <div className="relative aspect-[4/3] w-full">
          <ManualFigureImage
            assetPath={assetPath}
            source={spec.source}
            page={spec.page}
            alt={spec.caption}
            fallbackNote={spec.fallbackNote}
            onFallbackNote={setRuntimeNote}
          />
        </div>
        <figcaption className="border-t border-garage-border px-3 py-2">
          {note && (
            <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
              {note}
            </p>
          )}
          <p className="text-sm leading-relaxed text-garage-text">{spec.caption}</p>
          <p className="mt-1 font-mono text-2xs text-garage-muted">
            {spec.source} · page {spec.page}
            {spec.figureId ? ` · fig. ${spec.figureId}` : ""}
          </p>
        </figcaption>
      </figure>
    </ArtifactShell>
  );
}
