import { WeldPhotoAnalysisSchema, type WeldPhotoAnalysis } from "@/lib/vision/schemas";
import { pickBestExemplar } from "@/lib/vision/exemplars";

const DISCLAIMER =
  "Visual diagnosis from a photo alone may be insufficient. Hidden causes (gas flow, polarity, contamination) require setup checks and Machine Detective follow-up. A repair is never confirmed solely from a photo.";

const FORBIDDEN_REPAIR_PHRASES = [
  /repair\s+confirmed/i,
  /definitely\s+fixed/i,
  /root\s+cause\s+confirmed/i,
  /certainly\s+caused\s+by/i,
  /guaranteed\s+to\s+fix/i,
];

export function extractJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("No JSON object found in model response");
}

export function sanitizeAnalysisText(text: string): string {
  let out = text;
  for (const pattern of FORBIDDEN_REPAIR_PHRASES) {
    out = out.replace(pattern, "possible visual indicator of");
  }
  return out;
}

export function parseWeldPhotoAnalysis(
  raw: unknown,
  process?: string,
): WeldPhotoAnalysis {
  const parsed = WeldPhotoAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid weld photo analysis: ${parsed.error.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const data = parsed.data;

  if (data.repairConfirmed !== false) {
    throw new Error("Model must not confirm repair from photo alone");
  }

  const visualObservations = data.visualObservations.map(sanitizeAnalysisText);
  const potentialCauses = data.potentialCauses.map((c) => ({
    ...c,
    cause: sanitizeAnalysisText(c.cause),
  }));

  const best = pickBestExemplar(data.possibleDefectCategories, process);

  return {
    ...data,
    visualObservations,
    potentialCauses,
    disclaimer: data.disclaimer || DISCLAIMER,
    matchedManualFigure: {
      ...data.matchedManualFigure,
      assetId: data.matchedManualFigure.assetId || best.assetId,
      source: data.matchedManualFigure.source || best.source,
      page: data.matchedManualFigure.page || best.page,
      label: data.matchedManualFigure.label || best.label,
      section: data.matchedManualFigure.section ?? best.section,
    },
    regions: data.regions.filter(
      (r) =>
        r.x >= 0 &&
        r.y >= 0 &&
        r.width > 0 &&
        r.height > 0 &&
        r.x + r.width <= 100 &&
        r.y + r.height <= 100,
    ),
  };
}

export function buildMockAnalysis(
  contextNotes?: string,
  process?: string,
): WeldPhotoAnalysis {
  const lower = (contextNotes ?? "").toLowerCase();
  const categories = /porous|porosity|hole|pinhole/i.test(lower)
    ? (["porosity"] as const)
    : /spatter/i.test(lower)
      ? (["excessive_spatter"] as const)
      : (["uncertain"] as const);

  const best = pickBestExemplar([...categories], process);

  return WeldPhotoAnalysisSchema.parse({
    possibleDefectCategories: [...categories],
    visualObservations: [
      "Surface texture in the weld bead region appears irregular (mock analysis — add ANTHROPIC_API_KEY for live vision).",
      "Cannot verify shielding gas, polarity, or base-metal cleanliness from this photo alone.",
    ],
    confidence: "low",
    uncertaintyNotes: [
      "Mock mode: live Claude vision is unavailable.",
      "Lighting and angle may hide internal defects.",
    ],
    potentialCauses: best.manualText.split(";").slice(0, 3).map((cause) => ({
      cause: cause.trim(),
      groundedInManual: true,
      citation: {
        source: best.source,
        page: best.page,
        section: best.section,
        excerpt: best.description,
      },
    })),
    recommendedNextStep:
      "Run Machine Detective checks for polarity, gas flow, and surface cleanliness before changing settings.",
    matchedManualFigure: {
      assetId: best.assetId,
      source: best.source,
      page: best.page,
      label: best.label,
      section: best.section,
      matchScore: 0.55,
    },
    alternateFigures: [],
    regions: [],
    callouts: [],
    disclaimer: DISCLAIMER,
    repairConfirmed: false,
  });
}
