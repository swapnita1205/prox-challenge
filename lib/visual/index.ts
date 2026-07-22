export type {
  FigureCandidate,
  RankedFigure,
  VisualArtifactType,
  VisualPolicyInput,
} from "@/lib/visual/types";

export {
  QUERY_PAGE_HINTS,
  bestFigureForQuery,
  loadFigureCandidates,
  pageAssetId,
  rankRelevantFigures,
} from "@/lib/visual/figures";

export {
  buildAnnotatedManualFigureArtifact,
  buildComponentMapArtifact,
  buildManualFigureArtifact,
  buildWeldDefectComparisonFromManual,
  resolveFigureImagePath,
  resolveTargetFigure,
  selectVisualArtifactTypes,
  shouldAttachVisual,
} from "@/lib/visual/policy";

export { applyVisualArtifactPolicy } from "@/lib/visual/attach";
