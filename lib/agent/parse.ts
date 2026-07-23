import {
  AgentResponseSchema,
  DiagnosticStateSchema,
  type AgentIntent,
  type AgentResponse,
} from "@/lib/agent/schemas";
import { normalizeArtifactSpec, validateArtifactSpec } from "@/lib/artifacts/registry";
import type { AgentContext } from "@/lib/agent/context";
import { HypothesisSchema, type Citation, type Hypothesis } from "@/lib/schemas/conversation";

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
 * Qualitative confidence words the model sometimes uses in place of a numeric
 * posterior. Mapped to representative probabilities so a hypothesis list stays
 * usable rather than being rejected wholesale.
 */
const CONFIDENCE_WORD_TO_POSTERIOR: Record<string, number> = {
  "very high": 0.9,
  high: 0.8,
  "medium-high": 0.65,
  "moderate-high": 0.65,
  medium: 0.5,
  moderate: 0.5,
  "medium-low": 0.35,
  low: 0.2,
  "very low": 0.1,
};

function toPosterior(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = value > 1 ? value / 100 : value;
    return Math.max(0, Math.min(1, n));
  }
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key in CONFIDENCE_WORD_TO_POSTERIOR) return CONFIDENCE_WORD_TO_POSTERIOR[key]!;
    const num = Number(key.replace(/[%\s]/g, ""));
    if (Number.isFinite(num)) {
      const n = num > 1 ? num / 100 : num;
      return Math.max(0, Math.min(1, n));
    }
  }
  return null;
}

function slugId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `hyp-${base || "cause"}`;
}

/**
 * Coerce a single hypothesis into the schema shape. The model occasionally
 * emits `description`/`confidence`/`reason` (or `likelihood`) instead of the
 * expected `label`/`posterior`/`evidence`; recover those rather than letting
 * one malformed entry reject the entire response. Returns null only when there
 * is no usable label to show.
 */
function coerceHypothesis(raw: unknown): Hypothesis | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const label = [o.label, o.description, o.name, o.hypothesis, o.cause].find(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  if (!label) return null;

  const posterior =
    toPosterior(o.posterior) ??
    toPosterior(o.confidence) ??
    toPosterior(o.likelihood) ??
    toPosterior(o.probability) ??
    0.5;

  const id = typeof o.id === "string" && o.id.trim() ? o.id : slugId(label);

  let evidence: string[] = [];
  if (Array.isArray(o.evidence)) {
    evidence = o.evidence.filter((e): e is string => typeof e === "string");
  } else if (typeof o.evidence === "string" && o.evidence.trim()) {
    evidence = [o.evidence];
  } else if (typeof o.reason === "string" && o.reason.trim()) {
    evidence = [o.reason];
  }

  const ruledOut = typeof o.ruledOut === "boolean" ? o.ruledOut : undefined;

  return {
    id,
    label,
    posterior,
    evidence,
    ...(ruledOut !== undefined ? { ruledOut } : {}),
  };
}

/**
 * Repair a `diagnosticState` before Zod so a malformed hypothesis list does not
 * discard an otherwise valid answer (with citations, artifact, and a clarifying
 * question). Mirrors the artifact handling: coerce what we can, drop only the
 * sub-object if it still cannot be validated.
 */
function coerceDiagnosticState(value: unknown, notes: string[]): unknown {
  if (value == null) return value;
  if (typeof value !== "object" || Array.isArray(value)) {
    notes.push("diagnostic_state_dropped_invalid");
    return null;
  }

  const ds = { ...(value as Record<string, unknown>) };

  // Accept `topHypotheses` as an alias the model sometimes uses.
  const rawHyps = Array.isArray(ds.hypotheses)
    ? (ds.hypotheses as unknown[])
    : Array.isArray(ds.topHypotheses)
      ? (ds.topHypotheses as unknown[])
      : null;

  if (rawHyps) {
    const coerced = rawHyps
      .map(coerceHypothesis)
      .filter((h): h is Hypothesis => h !== null);
    const changed =
      coerced.length !== rawHyps.length ||
      !Array.isArray((value as Record<string, unknown>).hypotheses) ||
      rawHyps.some((h) => !HypothesisSchema.safeParse(h).success);
    ds.hypotheses = coerced;
    delete ds.topHypotheses;
    if (changed) notes.push("diagnostic_hypotheses_coerced");
  }

  const result = DiagnosticStateSchema.safeParse(ds);
  if (result.success) return result.data;

  notes.push("diagnostic_state_dropped_invalid");
  return null;
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

  if (obj.diagnosticState != null) {
    obj.diagnosticState = coerceDiagnosticState(obj.diagnosticState, notes);
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
