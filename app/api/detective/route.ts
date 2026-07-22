import { NextResponse } from "next/server";
import { z } from "zod";
import {
  answerDiagnosticQuestion,
  addObservation,
  buildSnapshot,
  getWhyAskingExplanation,
  markAlreadyChecked,
  startDiagnosticSession,
  startOver,
} from "@/lib/detective/engine";
import { sessionToHypothesisArtifact } from "@/lib/detective/artifact";
import {
  loadServerSession,
  saveServerSession,
  deleteServerSession,
} from "@/lib/detective/persist";
import { DiagnosticSessionSchema } from "@/lib/detective/schemas";

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    complaint: z.string().min(1),
    sessionId: z.string().optional(),
  }),
  z.object({
    action: z.literal("answer"),
    sessionId: z.string(),
    questionId: z.string(),
    answer: z.string(),
  }),
  z.object({
    action: z.literal("already_checked"),
    sessionId: z.string(),
    questionId: z.string(),
    result: z.string(),
  }),
  z.object({
    action: z.literal("start_over"),
    sessionId: z.string().optional(),
    complaint: z.string().optional(),
  }),
  z.object({
    action: z.literal("get"),
    sessionId: z.string(),
  }),
  z.object({
    action: z.literal("why"),
    sessionId: z.string(),
  }),
  z.object({
    action: z.literal("add_observation"),
    sessionId: z.string(),
    text: z.string().min(1),
    supportsFaultIds: z.array(z.string()).default([]),
    contradictsFaultIds: z.array(z.string()).default([]),
    source: z.enum(["user", "inferred", "manual"]).default("inferred"),
  }),
]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    let session;

    switch (input.action) {
      case "start": {
        session = startDiagnosticSession(input.complaint, input.sessionId);
        break;
      }
      case "answer": {
        const existing = loadServerSession(input.sessionId);
        if (!existing) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
        session = answerDiagnosticQuestion(existing, input.questionId, input.answer);
        break;
      }
      case "already_checked": {
        const existing = loadServerSession(input.sessionId);
        if (!existing) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
        session = markAlreadyChecked(existing, input.questionId, input.result);
        break;
      }
      case "start_over": {
        if (input.sessionId) deleteServerSession(input.sessionId);
        session = startOver(input.complaint);
        break;
      }
      case "get": {
        const existing = loadServerSession(input.sessionId);
        if (!existing) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
        session = existing;
        break;
      }
      case "why": {
        const existing = loadServerSession(input.sessionId);
        if (!existing) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
        return NextResponse.json({
          explanation: getWhyAskingExplanation(existing),
          session: existing,
        });
      }
      case "add_observation": {
        const existing = loadServerSession(input.sessionId);
        if (!existing) {
          return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }
        session = addObservation(
          existing,
          input.text,
          input.supportsFaultIds,
          input.contradictsFaultIds,
          input.source,
        );
        break;
      }
    }

    saveServerSession(session);
    const snapshot = buildSnapshot(session);
    const artifact = sessionToHypothesisArtifact(session);

    return NextResponse.json({
      session: DiagnosticSessionSchema.parse(session),
      snapshot,
      artifact,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Detective engine error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
