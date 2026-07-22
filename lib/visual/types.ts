import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import type { Citation } from "@/lib/schemas/conversation";
import type { RetrievalBundle } from "@/lib/retrieval/types";

export interface FigureProvenance {
  source: string;
  page: number;
  section?: string;
  bbox?: number[];
  neighboringText?: string;
  assetPath?: string;
}

export interface FigureCandidate {
  id: string;
  kind: string;
  caption: string;
  isDiagram: boolean;
  provenance: FigureProvenance;
  /** True when showing a full-page render instead of a cropped figure asset. */
  isPageFallback?: boolean;
}

export interface RankedFigure extends FigureCandidate {
  score: number;
  matchReasons: string[];
}

export type VisualArtifactType = Extract<
  ArtifactSpec["type"],
  | "manual-figure"
  | "annotated-manual-figure"
  | "polarity-diagram"
  | "cable-routing-diagram"
  | "weld-defect-comparison"
  | "settings-configurator"
  | "component-map"
>;

export interface VisualPolicyInput {
  query: string;
  citations?: Citation[];
  acceptedPages?: Array<{ source?: string; page: number }>;
  requiredTypes?: Array<ArtifactSpec["type"]>;
  category?: string;
  hasUserImage?: boolean;
  retrievalBundle?: RetrievalBundle;
}
