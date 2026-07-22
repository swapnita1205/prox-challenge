import { hasValidApiKey } from "@/lib/env";
import {
  buildExemplarContextBlock,
  getExemplarsForPrompt,
  pickBestExemplar,
} from "@/lib/vision/exemplars";
import { buildMockAnalysis, extractJsonFromModelText, parseWeldPhotoAnalysis } from "@/lib/vision/parse";
import type { AnalyzeImageContext, WeldPhotoAnalysis } from "@/lib/vision/schemas";
import { VISIBLE_DEFECT_CATEGORY_SCHEMA } from "@/lib/vision/schemas";

/** Prefer env override; default to a current Messages API Sonnet id (legacy dated ids 404). */
const VISION_MODEL = process.env.WELDPILOT_VISION_MODEL ?? "claude-sonnet-4-5";
const VISION_MODEL_FALLBACKS = [
  VISION_MODEL,
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
].filter((m, i, arr) => arr.indexOf(m) === i);

const ANALYSIS_JSON_SCHEMA = `{
  "possibleDefectCategories": ["porosity" | "excessive_spatter" | "burn_through" | "inadequate_penetration" | "excess_penetration" | "crooked_wavy_bead" | "slag_inclusion" | "undercut" | "arc_strikes" | "uncertain"],
  "visualObservations": ["string — only what is visibly apparent"],
  "confidence": "high" | "medium" | "low",
  "uncertaintyNotes": ["string"],
  "potentialCauses": [{ "cause": "string", "groundedInManual": boolean, "citation": { "source": "owner-manual.pdf", "page": number, "section": "string", "excerpt": "string" } }],
  "recommendedNextStep": "string — next observation or test, not a confirmed fix",
  "matchedManualFigure": { "assetId": "string", "source": "owner-manual.pdf", "page": number, "label": "string", "section": "string", "matchScore": 0-1 },
  "alternateFigures": [{ "assetId": "string", "source": "owner-manual.pdf", "page": number, "label": "string", "matchScore": 0-1 }],
  "regions": [{ "id": "r1", "label": "string", "x": 0-100, "y": 0-100, "width": 0-100, "height": 0-100, "description": "optional" }],
  "callouts": [{ "id": "c1", "label": "string", "x": 0-100, "y": 0-100, "targetRegionId": "optional" }],
  "disclaimer": "Visual diagnosis from a photo alone may be insufficient...",
  "repairConfirmed": false
}`;

function buildPrompt(context: AnalyzeImageContext | undefined): string {
  const exemplars = getExemplarsForPrompt(context?.process);
  const settings = [
    context?.process && `Process: ${context.process}`,
    context?.inputVoltage && `Input voltage: ${context.inputVoltage}V`,
    context?.polarity && `Polarity: ${context.polarity}`,
    context?.gas && `Shielding gas: ${context.gas}`,
    context?.material && `Material: ${context.material}`,
    context?.userNotes && `User notes: ${context.userNotes}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are WeldPilot's visual weld inspector for the Vulcan OmniPro 220.

Analyze the uploaded weld photo. Identify ONLY visible surface characteristics — do NOT claim certainty about hidden causes (gas flow, polarity, internal contamination).

Rules:
- List multiple possible defect categories if ambiguous; use "uncertain" when appropriate.
- potentialCauses must cite owner-manual.pdf sections from the exemplar list when groundedInManual is true.
- repairConfirmed MUST be false — never confirm a repair or root cause from a photo alone.
- regions/callouts: only include normalized 0–100 bounding boxes if you can localize a visible feature with reasonable confidence; otherwise return empty arrays.
- Do not diagnose electrical or gas system failures as confirmed from appearance alone.

Allowed categories: ${VISIBLE_DEFECT_CATEGORY_SCHEMA.options.join(", ")}

Manual weld-diagnosis exemplars:
${buildExemplarContextBlock(exemplars)}

${settings ? `Known machine context:\n${settings}\n` : ""}

Respond with ONLY valid JSON matching:
${ANALYSIS_JSON_SCHEMA}`;
}

export async function analyzeWeldPhoto(input: {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  context?: AnalyzeImageContext;
  useMock?: boolean;
}): Promise<{ analysis: WeldPhotoAnalysis; mock: boolean }> {
  if (input.useMock || !hasValidApiKey()) {
    return {
      analysis: buildMockAnalysis(input.context?.userNotes, input.context?.process),
      mock: true,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const prompt = buildPrompt(input.context);
  const messageBody = {
    max_tokens: 2048,
    messages: [
      {
        role: "user" as const,
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: input.mimeType,
              data: input.imageBase64,
            },
          },
          { type: "text" as const, text: prompt },
        ],
      },
    ],
  };

  let response: Response | null = null;
  let lastErr = "";
  for (const model of VISION_MODEL_FALLBACKS) {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...messageBody, model }),
    });
    if (response.ok) break;
    lastErr = await response.text();
    // Retry next candidate only for unknown/unavailable model ids.
    if (response.status !== 404 || !/model:/i.test(lastErr)) {
      throw new Error(`Vision API error (${response.status}): ${lastErr.slice(0, 300)}`);
    }
  }

  if (!response?.ok) {
    throw new Error(`Vision API error (${response?.status ?? 404}): ${lastErr.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = payload.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty vision model response");

  const raw = extractJsonFromModelText(text);
  const analysis = parseWeldPhotoAnalysis(raw, input.context?.process);

  if (!analysis.matchedManualFigure.assetId) {
    const best = pickBestExemplar(analysis.possibleDefectCategories, input.context?.process);
    analysis.matchedManualFigure = {
      assetId: best.assetId,
      source: best.source,
      page: best.page,
      label: best.label,
      section: best.section,
      matchScore: analysis.matchedManualFigure.matchScore,
    };
  }

  return { analysis, mock: false };
}
