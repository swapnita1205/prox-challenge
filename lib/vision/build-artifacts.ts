import type { WeldPhotoAnalysis } from "@/lib/vision/schemas";
import type { WeldDefectComparisonArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";

type ComparisonSpec = z.infer<typeof WeldDefectComparisonArtifactSchema>;

export function buildWeldDefectComparisonArtifact(
  analysis: WeldPhotoAnalysis,
  imageId: string,
): ComparisonSpec {
  const primary = analysis.possibleDefectCategories[0] ?? "uncertain";
  const defectLabel = primary.replace(/_/g, " ");

  const exemplars = [
    {
      id: analysis.matchedManualFigure.assetId,
      label: analysis.matchedManualFigure.label,
      description: `Manual reference — ${analysis.matchedManualFigure.source} p.${analysis.matchedManualFigure.page}`,
      assetId: analysis.matchedManualFigure.assetId,
      source: analysis.matchedManualFigure.source,
      page: analysis.matchedManualFigure.page,
      matchScore: analysis.matchedManualFigure.matchScore,
    },
    ...analysis.alternateFigures.map((alt) => ({
      id: alt.assetId,
      label: alt.label,
      description: `Alternate manual reference — p.${alt.page}`,
      assetId: alt.assetId,
      source: alt.source,
      page: alt.page,
      matchScore: alt.matchScore,
    })),
  ];

  const confidenceLevel =
    analysis.confidence === "high"
      ? "high"
      : analysis.confidence === "medium"
        ? "medium"
        : "low";

  return {
    type: "weld-defect-comparison",
    title: "Weld Photo Diagnosis",
    description: analysis.visualObservations.join(" "),
    confidence: confidenceLevel,
    safetyNotice: analysis.disclaimer,
    citations: analysis.potentialCauses
      .filter((c) => c.citation)
      .map((c) => c.citation!)
      .slice(0, 4),
    defectName: defectLabel,
    userDescription: analysis.visualObservations[0],
    exemplars,
    selectedExemplarId: analysis.matchedManualFigure.assetId,
    userImage: {
      imageId,
      regions: analysis.regions,
      callouts: analysis.callouts,
    },
    recommendedNextStep: analysis.recommendedNextStep,
    uncertaintyNotes: analysis.uncertaintyNotes,
    possibleCategories: analysis.possibleDefectCategories,
    visualObservations: analysis.visualObservations,
    potentialCauses: analysis.potentialCauses.map((c) => c.cause),
  };
}
