"use client";

import { useState } from "react";
import { ARTIFACT_GALLERY_SAMPLES } from "@/lib/artifacts/samples";
import { ARTIFACT_TYPE_LABELS } from "@/lib/artifacts/registry";
import { ArtifactRenderer } from "@/components/artifacts/ArtifactRenderer";
import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";

export function ArtifactGalleryClient() {
  const [selected, setSelected] = useState(0);
  const spec = ARTIFACT_GALLERY_SAMPLES[selected]!;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[280px_1fr]">
      <nav className="space-y-1" aria-label="Artifact types">
        {ARTIFACT_GALLERY_SAMPLES.map((sample, i) => (
          <button
            key={sample.type}
            type="button"
            onClick={() => setSelected(i)}
            className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
              selected === i
                ? "border-garage-orange bg-garage-orange/10 text-garage-text"
                : "border-garage-border text-garage-muted hover:border-garage-orange/40"
            }`}
          >
            <span className="font-mono text-[10px] uppercase text-garage-orange">
              {sample.type}
            </span>
            <span className="mt-0.5 block">{ARTIFACT_TYPE_LABELS[sample.type]}</span>
          </button>
        ))}
      </nav>

      <section className="rounded-xl border border-garage-border bg-garage-panel/50 p-4 sm:p-6">
        <ArtifactRenderer spec={spec as ArtifactSpec} />
      </section>
    </div>
  );
}
