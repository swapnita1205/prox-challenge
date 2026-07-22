"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { WeldDefectComparisonArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";
import { getPageRenderPath } from "@/lib/retrieval/search";
import { useConversation } from "@/lib/conversation/context";
import {
  resolveSessionImageUrl,
  useSessionImages,
} from "@/lib/vision/session-images-client";
import { AlertTriangle } from "lucide-react";

type Spec = z.infer<typeof WeldDefectComparisonArtifactSchema>;

function AnnotatedUserImage({
  src,
  regions,
  callouts,
}: {
  src: string;
  regions: Spec["userImage"] extends infer U
    ? U extends { regions: infer R }
      ? R
      : never
    : never;
  callouts: Spec["userImage"] extends infer U
    ? U extends { callouts: infer C }
      ? C
      : never
    : never;
}) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-garage-border bg-garage-bg">
      <Image src={src} alt="Uploaded weld" fill className="object-contain p-1" unoptimized />
      {(regions.length > 0 || callouts.length > 0) && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {regions.map((region) => (
            <rect
              key={region.id}
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              fill="rgba(232, 93, 4, 0.2)"
              stroke="#e85d04"
              strokeWidth="0.4"
            />
          ))}
          {callouts.map((c, i) => (
            <g key={c.id}>
              <circle cx={c.x} cy={c.y} r="1.8" fill="#e85d04" />
              <text x={c.x + 2} y={c.y + 0.8} fill="#e85d04" fontSize="2.2" fontFamily="monospace">
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

export function WeldDefectComparisonArtifact({ spec }: { spec: Spec }) {
  const { conversation } = useConversation();
  const { getImageUrl } = useSessionImages();
  const [selected, setSelected] = useState(spec.selectedExemplarId ?? spec.exemplars[0]?.id);

  const selectedExemplar = useMemo(
    () => spec.exemplars.find((e) => e.id === selected) ?? spec.exemplars[0],
    [spec.exemplars, selected],
  );

  const userImageSrc = spec.userImage
    ? resolveSessionImageUrl(
        spec.userImage.imageId,
        conversation.id,
        getImageUrl(spec.userImage.imageId),
      )
    : null;

  const manualSrc =
    selectedExemplar?.source && selectedExemplar.page
      ? getPageRenderPath(selectedExemplar.source, selectedExemplar.page)
      : null;

  return (
    <ArtifactShell {...spec}>
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          {spec.safetyNotice ??
            "Visual diagnosis from a photo alone may be insufficient. A repair is never confirmed solely from a photo."}
        </p>
      </div>

      <p className="text-sm text-garage-text">
        Comparing <strong className="capitalize">{spec.defectName}</strong>
        {spec.confidence && (
          <span className="ml-2 font-mono text-xs text-garage-orange">
            ({spec.confidence} confidence)
          </span>
        )}
      </p>

      {spec.visualObservations.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-garage-text" role="list">
          {spec.visualObservations.map((obs, i) => (
            <li key={i}>{obs}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-xs uppercase text-garage-muted">Your weld</p>
          {userImageSrc ? (
            <AnnotatedUserImage
              src={userImageSrc}
              regions={spec.userImage?.regions ?? []}
              callouts={spec.userImage?.callouts ?? []}
            />
          ) : (
            <p className="text-sm text-garage-muted">No uploaded image in this session.</p>
          )}
          {spec.userImage && spec.userImage.callouts.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-garage-muted" role="list">
              {spec.userImage.callouts.map((c, i) => (
                <li key={c.id}>
                  <span className="font-mono text-garage-orange">{i + 1}.</span> {c.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 font-mono text-xs uppercase text-garage-muted">Manual example</p>
          {manualSrc ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-garage-border bg-garage-bg">
              <Image
                src={manualSrc}
                alt={selectedExemplar?.label ?? "Manual exemplar"}
                fill
                className="object-contain p-1"
                unoptimized
              />
            </div>
          ) : (
            <p className="text-sm text-garage-muted">No manual figure selected.</p>
          )}
          {selectedExemplar && (
            <p className="mt-2 text-xs text-garage-muted">
              {selectedExemplar.label}
              {selectedExemplar.source && selectedExemplar.page && (
                <> — {selectedExemplar.source} p.{selectedExemplar.page}</>
              )}
              {selectedExemplar.matchScore != null && (
                <span className="ml-2 font-mono text-garage-orange">
                  {Math.round(selectedExemplar.matchScore * 100)}% match
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {spec.potentialCauses.length > 0 && (
        <div>
          <p className="mb-1 font-mono text-xs uppercase text-garage-muted">
            Possible causes (manual-grounded)
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-garage-text" role="list">
            {spec.potentialCauses.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {spec.recommendedNextStep && (
        <p className="rounded-lg border border-garage-border bg-garage-bg p-3 text-sm text-garage-text">
          <span className="font-medium">Next step:</span> {spec.recommendedNextStep}
        </p>
      )}

      {spec.exemplars.length > 1 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {spec.exemplars.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => setSelected(ex.id)}
              className={`rounded-lg border p-2 text-left text-xs transition ${
                selected === ex.id
                  ? "border-garage-orange ring-1 ring-garage-orange/50"
                  : "border-garage-border hover:border-garage-orange/40"
              }`}
            >
              <span className="font-medium text-garage-text">{ex.label}</span>
              {ex.matchScore != null && (
                <span className="ml-2 font-mono text-garage-orange">
                  {Math.round(ex.matchScore * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </ArtifactShell>
  );
}
