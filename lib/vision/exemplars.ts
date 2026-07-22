import type { VisibleDefectCategory } from "@/lib/vision/schemas";

export interface ManualDefectExemplar {
  id: string;
  assetId: string;
  source: string;
  page: number;
  label: string;
  section: string;
  process: "wire" | "stick" | "both";
  defectCategories: VisibleDefectCategory[];
  description: string;
  manualText: string;
}

/** Curated weld-diagnosis pages from owner-manual.pdf p35–40 */
export const MANUAL_DEFECT_EXEMPLARS: ManualDefectExemplar[] = [
  {
    id: "wire-porosity-p37",
    assetId: "owner-manual-p37-page",
    source: "owner-manual.pdf",
    page: 37,
    label: "Wire Weld – Porosity",
    section: "Wire Weld – Porosity",
    process: "wire",
    defectCategories: ["porosity"],
    description: "Small cavities or holes in the bead.",
    manualText:
      "Incorrect polarity; insufficient shielding gas (MIG only); dirty workpiece or welding wire; inconsistent travel speed; CTWD too long.",
  },
  {
    id: "wire-spatter-p37",
    assetId: "owner-manual-p37-page",
    source: "owner-manual.pdf",
    page: 37,
    label: "Wire Weld – Excessive Spatter",
    section: "Wire Weld – Excessive Spatter",
    process: "wire",
    defectCategories: ["excessive_spatter"],
    description: "Fine spatter is normal; grainy large spatter is a problem.",
    manualText:
      "Dirty workpiece or wire; incorrect polarity; insufficient shielding gas; wire feeding too fast; CTWD too long.",
  },
  {
    id: "wire-burnthrough-p37",
    assetId: "owner-manual-p37-page",
    source: "owner-manual.pdf",
    page: 37,
    label: "Wire Weld – Burn-Through",
    section: "Wire Weld – Burn-Through",
    process: "wire",
    defectCategories: ["burn_through", "excess_penetration"],
    description: "Base material melts away, leaving a hole in the weld.",
    manualText: "Workpiece overheating; travel speed too slow; excessive material at weld.",
  },
  {
    id: "wire-crooked-p37",
    assetId: "owner-manual-p37-page",
    source: "owner-manual.pdf",
    page: 37,
    label: "Wire Weld – Crooked/Wavy Bead",
    section: "Wire Weld – Crooked/Wavy Bead",
    process: "wire",
    defectCategories: ["crooked_wavy_bead"],
    description: "Bead wanders or waves instead of a straight uniform line.",
    manualText: "Inaccurate welding; inconsistent travel speed; CTWD too long.",
  },
  {
    id: "wire-penetration-p36",
    assetId: "owner-manual-p36-page",
    source: "owner-manual.pdf",
    page: 36,
    label: "Wire Weld Penetration",
    section: "Wire Weld Penetration",
    process: "wire",
    defectCategories: ["inadequate_penetration", "excess_penetration", "burn_through"],
    description: "Excess, proper, or inadequate penetration profile views.",
    manualText: "Adjust current, travel speed, and heat input for material thickness.",
  },
  {
    id: "stick-porosity-p40",
    assetId: "owner-manual-p40-page",
    source: "owner-manual.pdf",
    page: 40,
    label: "Stick Weld – Porosity",
    section: "Stick Weld – Porosity",
    process: "stick",
    defectCategories: ["porosity"],
    description: "Small cavities or holes in the stick weld bead.",
    manualText: "Dirty workpiece or fill material; inconsistent welding speed.",
  },
  {
    id: "stick-spatter-p40",
    assetId: "owner-manual-p40-page",
    source: "owner-manual.pdf",
    page: 40,
    label: "Stick Weld – Excessive Spatter",
    section: "Stick Weld – Excessive Spatter",
    process: "stick",
    defectCategories: ["excessive_spatter"],
    description: "Grainy large spatter on stick welds.",
    manualText: "Dirty workpiece or fill material.",
  },
  {
    id: "stick-burnthrough-p40",
    assetId: "owner-manual-p40-page",
    source: "owner-manual.pdf",
    page: 40,
    label: "Stick Weld – Burn-Through",
    section: "Stick Weld – Burn-Through",
    process: "stick",
    defectCategories: ["burn_through"],
    description: "Hole burned through base material.",
    manualText: "Workpiece overheating; welding speed too slow; excessive fill material.",
  },
  {
    id: "stick-penetration-p39",
    assetId: "owner-manual-p39-page",
    source: "owner-manual.pdf",
    page: 39,
    label: "Stick Weld Penetration",
    section: "Stick Weld Penetration",
    process: "stick",
    defectCategories: ["inadequate_penetration", "excess_penetration", "burn_through"],
    description: "Profile views of excess, proper, and inadequate penetration.",
    manualText: "Adjust current, technique, bevel, and fill material.",
  },
];

export function getExemplarsForPrompt(process?: string): ManualDefectExemplar[] {
  if (process === "stick") {
    return MANUAL_DEFECT_EXEMPLARS.filter((e) => e.process === "stick" || e.process === "both");
  }
  if (process === "mig" || process === "flux" || process === "tig") {
    return MANUAL_DEFECT_EXEMPLARS.filter((e) => e.process === "wire" || e.process === "both");
  }
  return MANUAL_DEFECT_EXEMPLARS;
}

export function pickBestExemplar(
  categories: VisibleDefectCategory[],
  process?: string,
): ManualDefectExemplar {
  const pool = getExemplarsForPrompt(process);
  const primary = categories[0] ?? "uncertain";
  const match = pool.find((e) => e.defectCategories.includes(primary));
  return match ?? pool[0]!;
}

export function buildExemplarContextBlock(exemplars: ManualDefectExemplar[]): string {
  return exemplars
    .map(
      (e) =>
        `- ${e.label} (${e.source} p.${e.page}, assetId: ${e.assetId}): ${e.description}. Manual notes: ${e.manualText}`,
    )
    .join("\n");
}
