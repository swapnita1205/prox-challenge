import type { z } from "zod";
import type { ArtifactConfidenceSchema } from "@/lib/schemas/artifacts/base";

type ArtifactConfidence = z.infer<typeof ArtifactConfidenceSchema>;

const STYLES: Record<ArtifactConfidence, string> = {
  high: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  low: "bg-garage-panel text-garage-muted border-garage-border",
};

interface ConfidenceBadgeProps {
  confidence: ArtifactConfidence;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STYLES[confidence]}`}
    >
      {confidence} confidence
    </span>
  );
}
