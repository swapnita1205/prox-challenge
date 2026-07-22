import { getKnowledgeGraph } from "@/lib/knowledge/build";
import { findFaultsForSymptom, findSymptomByName } from "@/lib/knowledge/queries";
import type { VisibleDefectCategory, WeldPhotoAnalysis } from "@/lib/vision/schemas";

const CATEGORY_TO_SYMPTOM: Partial<Record<VisibleDefectCategory, string>> = {
  porosity: "porosity",
  excessive_spatter: "spatter",
  burn_through: "burn through",
  inadequate_penetration: "penetration",
  excess_penetration: "penetration",
  crooked_wavy_bead: "crooked",
};

const CATEGORY_KEYWORDS: Partial<Record<VisibleDefectCategory, RegExp>> = {
  porosity: /porosity|porous|cavities|holes/i,
  excessive_spatter: /spatter/i,
  burn_through: /burn.?through|melt/i,
  inadequate_penetration: /penetration|inadequate/i,
  excess_penetration: /penetration|excess/i,
  crooked_wavy_bead: /crooked|wavy/i,
};

export function mapAnalysisToFaultIds(
  analysis: WeldPhotoAnalysis,
  complaint = "porosity",
): string[] {
  const graph = getKnowledgeGraph();
  const primary = analysis.possibleDefectCategories.find((c) => c !== "uncertain");
  const symptomKey = (primary && CATEGORY_TO_SYMPTOM[primary]) ?? complaint;
  const symptom =
    findSymptomByName(graph, symptomKey) ?? findSymptomByName(graph, "porosity");
  if (!symptom) return [];

  const faults = findFaultsForSymptom(graph, symptom.id);
  const keyword = primary ? CATEGORY_KEYWORDS[primary] : null;

  const matched = keyword
    ? faults.filter((f) => f.fault && keyword.test(f.fault.name))
    : faults;

  const fromCauses = analysis.potentialCauses.flatMap((c) => {
    const hits = faults.filter(
      (f) => f.fault && c.cause.toLowerCase().includes(f.fault.name.toLowerCase().slice(0, 12)),
    );
    return hits.map((h) => h.fault!.id);
  });

  const ids = [
    ...matched.map((f) => f.fault!.id),
    ...fromCauses,
  ];

  return [...new Set(ids)];
}

export function buildVisualObservationSummary(analysis: WeldPhotoAnalysis): string {
  const cats = analysis.possibleDefectCategories.join(", ");
  const obs = analysis.visualObservations.slice(0, 2).join("; ");
  return `Visual analysis (photo): possible ${cats}. Observed: ${obs}`;
}
