import { NextRequest } from "next/server";
import { AnalyzeImageRequestSchema } from "@/lib/schemas/api";
import { hasValidApiKey } from "@/lib/env";
import { analyzeWeldPhoto } from "@/lib/vision/analyze";
import { buildWeldDefectComparisonArtifact } from "@/lib/vision/build-artifacts";
import {
  buildVisualObservationSummary,
  mapAnalysisToFaultIds,
} from "@/lib/vision/map-detective";
import { validateBase64Image } from "@/lib/vision/validate";
import { makeImageId, storeSessionImage } from "@/lib/vision/session-images";
import {
  addObservation,
  startDiagnosticSession,
} from "@/lib/detective/engine";
import { loadServerSession, saveServerSession } from "@/lib/detective/persist";
import { sessionToHypothesisArtifact } from "@/lib/detective/artifact";
import { buildSnapshot } from "@/lib/detective/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const imageId = request.nextUrl.searchParams.get("imageId");
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!imageId || !conversationId) {
    return Response.json({ error: "imageId and conversationId required" }, { status: 400 });
  }

  const { getSessionImage } = await import("@/lib/vision/session-images");
  const entry = getSessionImage(imageId, conversationId);
  if (!entry) {
    return Response.json({ error: "Image not found or session expired" }, { status: 404 });
  }

  const buffer = Buffer.from(entry.base64, "base64");
  return new Response(buffer, {
    headers: {
      "Content-Type": entry.mimeType,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AnalyzeImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.errors.map((e) => e.message).join("; ") },
      { status: 400 },
    );
  }

  const { conversationId, imageBase64, mimeType, context, mock, sessionId } = parsed.data;

  const validation = validateBase64Image(imageBase64, mimeType);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const useMock = mock === true || !hasValidApiKey();

  try {
    const { analysis, mock: isMock } = await analyzeWeldPhoto({
      imageBase64,
      mimeType,
      context,
      useMock,
    });

    const imageId = makeImageId(conversationId);
    storeSessionImage({
      imageId,
      conversationId,
      mimeType,
      base64: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
    });

    const artifactId = `weld-photo-${conversationId}-${Date.now()}`;
    const artifact = buildWeldDefectComparisonArtifact(analysis, imageId);

    const detectiveSessionId = sessionId ?? conversationId;
    let detectiveSession =
      loadServerSession(detectiveSessionId) ??
      startDiagnosticSession(
        context?.userNotes ?? `Weld photo: ${analysis.possibleDefectCategories.join(", ")}`,
        detectiveSessionId,
        context?.process
          ? {
              process: context.process,
              inputVoltage: context.inputVoltage,
              polarity:
                context.polarity === "DCEP" || context.polarity === "DCEN"
                  ? context.polarity
                  : "unknown",
            }
          : {},
      );

    const supportsFaultIds = mapAnalysisToFaultIds(analysis);
    detectiveSession = addObservation(
      detectiveSession,
      buildVisualObservationSummary(analysis),
      supportsFaultIds,
      [],
      "inferred",
    );

    saveServerSession(detectiveSession);

    return Response.json({
      analysis,
      imageId,
      artifactId,
      artifact,
      detectiveSessionId,
      detectiveSession,
      detectiveSnapshot: buildSnapshot(detectiveSession),
      detectiveArtifact: sessionToHypothesisArtifact(detectiveSession),
      mock: isMock,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weld photo analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
