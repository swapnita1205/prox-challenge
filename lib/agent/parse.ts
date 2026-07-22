import {
  AgentResponseSchema,
  type AgentIntent,
  type AgentResponse,
} from "@/lib/agent/schemas";
import { normalizeArtifactSpec, validateArtifactSpec } from "@/lib/artifacts/registry";
import type { AgentContext } from "@/lib/agent/context";
import type { Citation } from "@/lib/schemas/conversation";

export interface ParseResult {
  response: AgentResponse;
  recovered: boolean;
  recoveryNotes: string[];
}

function extractJsonCandidates(raw: string): string[] {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  if (trimmed) candidates.push(trimmed);

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return [...new Set(candidates)];
}

function mergeCitations(
  modelCitations: Citation[],
  ctx: AgentContext,
): Citation[] {
  const merged = new Map<string, Citation>();
  for (const c of [...modelCitations, ...ctx.citations]) {
    const key = `${c.source}:${c.page}:${c.section ?? ""}`;
    if (!merged.has(key)) merged.set(key, c);
  }
  return [...merged.values()];
}

function buildFallbackResponse(
  intent: AgentIntent,
  ctx: AgentContext,
): AgentResponse {
  const citations = mergeCitations([], ctx);
  const artifact = ctx.artifacts[ctx.artifacts.length - 1] ?? null;

  return {
    intent,
    answer:
      "I could not verify a structured answer against the manual. Please rephrase your question with the welding process, input voltage, and symptom or setup step.",
    clarifyingQuestion: null,
    artifact,
    citations,
    safetyNotices: [],
    confidence: "low",
    suggestedActions: ctx.toolSummaries.slice(-3),
    diagnosticState: null,
  };
}

/**
 * Normalize legacy/partial artifact shapes before Zod, so a bad artifact
 * does not discard an otherwise valid answer.
 */
function coerceAgentPayload(
  parsed: unknown,
  notes: string[],
): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }
  const obj = { ...(parsed as Record<string, unknown>) };

  if (obj.artifact != null) {
    const normalized = normalizeArtifactSpec(obj.artifact);
    if (normalized) {
      obj.artifact = normalized;
      notes.push("artifact_normalized");
    } else {
      // Keep the answer; drop only the invalid artifact object.
      obj.artifact = null;
      notes.push("artifact_dropped_invalid");
    }
  }

  if (!Array.isArray(obj.citations)) obj.citations = [];
  if (!Array.isArray(obj.safetyNotices)) obj.safetyNotices = [];
  if (!Array.isArray(obj.suggestedActions)) obj.suggestedActions = [];

  return obj;
}

export function parseAgentResponse(
  raw: string | unknown,
  ctx: AgentContext,
  fallbackIntent: AgentIntent,
): ParseResult {
  const recoveryNotes: string[] = [];
  const text =
    typeof raw === "string"
      ? raw
      : raw != null
        ? JSON.stringify(raw)
        : "";

  if (!text.trim()) {
    recoveryNotes.push("empty_model_output");
    return {
      response: buildFallbackResponse(fallbackIntent, ctx),
      recovered: true,
      recoveryNotes,
    };
  }

  for (const candidate of extractJsonCandidates(text)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const coerced = coerceAgentPayload(parsed, recoveryNotes);
      const result = AgentResponseSchema.safeParse(coerced);
      if (result.success) {
        const data = result.data;
        // Prefer deterministic tool artifacts when present.
        const artifact =
          (ctx.artifacts.length > 0
            ? ctx.artifacts[ctx.artifacts.length - 1]
            : null) ??
          (data.artifact && validateArtifactSpec(data.artifact)) ??
          null;

        return {
          response: {
            ...data,
            artifact,
            citations: mergeCitations(data.citations, ctx),
          },
          // Artifact coerce notes are soft fixes, not full parse fallbacks.
          recovered: false,
          recoveryNotes,
        };
      }
      recoveryNotes.push(...result.error.errors.map((e) => `schema:${e.path.join(".")}`));
    } catch {
      recoveryNotes.push("json_parse_failed");
    }
  }

  recoveryNotes.push("structured_recovery_fallback");
  return {
    response: buildFallbackResponse(fallbackIntent, ctx),
    recovered: true,
    recoveryNotes,
  };
}

export function formatAnswerWithExtras(response: AgentResponse): string {
  let text = response.answer;

  if (response.clarifyingQuestion) {
    text += `\n\n${response.clarifyingQuestion}`;
    if (response.diagnosticState?.questionRationale) {
      text += `\n${response.diagnosticState.questionRationale}`;
    }
  }

  if (response.safetyNotices.length > 0) {
    // Deduplicate safety lines
    const unique = [...new Set(response.safetyNotices.map((n) => n.trim()).filter(Boolean))];
    text +=
      unique.length === 1
        ? `\n\nSafety reminder: ${unique[0]}`
        : `\n\nSafety reminders:\n${unique.map((n) => `- ${n}`).join("\n")}`;
  }

  if (response.confidence === "low") {
    text += "\n\nManual evidence for this is thin — worth double-checking against your owner's manual.";
  }

  return text;
}

export function* chunkText(text: string, size = 48): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}
