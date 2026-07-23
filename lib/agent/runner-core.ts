import { query, type Options, type Query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { classifyIntent, immediateClarificationQuestion } from "@/lib/agent/intent";
import {
  buildConfigurationClarificationResponse,
  buildSafetyBlockedResponse,
  clarificationLevel,
  missingFieldReasons,
  optionalFollowUp,
  requiredMissingFields,
  type ConfigurationField,
} from "@/lib/agent/clarification-policy";
import { createAgentContext, type AgentContext } from "@/lib/agent/context";
import {
  createWeldPilotMcpServer,
  weldpilotAllowedTools,
} from "@/lib/agent/mcp-server";
import {
  formatPrefetchedContext,
  runDeterministicPrefetch,
  summarizePrefetchFinding,
  type PrefetchOutcome,
} from "@/lib/agent/prefetch";
import {
  chunkText,
  formatAnswerWithExtras,
  parseAgentResponse,
} from "@/lib/agent/parse";
import { groundResponse } from "@/lib/grounding/engine";
import { STATUS_LABELS, type GroundingResult } from "@/lib/grounding/schemas";
import { PROGRESS_BY_TOOL, artifactProgressStep } from "@/lib/agent/progress";
import {
  AGENT_RESPONSE_JSON_SCHEMA,
  type AgentIntent,
  type AgentResponse,
} from "@/lib/agent/schemas";
import {
  buildSystemPrompt,
  buildUserPrompt,
  maxTurnsForIntent,
  resolveAgentModel,
} from "@/lib/agent/system-prompt";
import {
  buildWaterfall,
  effectiveInputTokens,
  extractToolCallsFromAssistantContent,
  safetyOutcomeFromGrounding,
  shortToolName,
  type AgentRunTelemetry,
  type InstrumentedAgentResult,
  type ModelInvocationRecord,
  type ToolCallRecord,
  type TokenUsage,
} from "@/lib/agent/telemetry";
import { getEnv } from "@/lib/env";
import type { StreamEvent } from "@/lib/schemas/api";
import type { MachineState, WeldMode } from "@/lib/schemas/conversation";
import { createId } from "@/lib/utils";
import { validateArtifactSpec } from "@/lib/artifacts/registry";

export type AgentQueryFn = (params: {
  prompt: string;
  options?: Options;
}) => Query;

export interface RunAgentParams {
  mode: WeldMode;
  message: string;
  machineState?: MachineState;
  queryFn?: AgentQueryFn;
  apiKey?: string;
}

function defaultQueryFn(params: { prompt: string; options?: Options }): Query {
  return query(params);
}

function extractTextFromMessage(msg: SDKMessage): string {
  if (msg.type === "assistant") {
    const content = msg.message?.content;
    if (!Array.isArray(content)) return "";
    return content
      .map((block) => ("text" in block && typeof block.text === "string" ? block.text : ""))
      .join("");
  }
  if (msg.type === "result" && msg.subtype === "success") {
    if (msg.structured_output != null) {
      return typeof msg.structured_output === "string"
        ? msg.structured_output
        : JSON.stringify(msg.structured_output);
    }
    return msg.result ?? "";
  }
  return "";
}

function buildQueryOptions(
  mode: WeldMode,
  intent: ReturnType<typeof classifyIntent>,
  ctx: ReturnType<typeof createAgentContext>,
  apiKey: string,
  model: string,
): Options {
  const mcpServer = createWeldPilotMcpServer(ctx);

  return {
    model,
    systemPrompt: buildSystemPrompt(mode, intent),
    mcpServers: {
      weldpilot: mcpServer,
    },
    tools: [],
    allowedTools: weldpilotAllowedTools(),
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: maxTurnsForIntent(intent),
    includePartialMessages: false,
    settingSources: [],
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: apiKey,
    },
    outputFormat: {
      type: "json_schema",
      schema: AGENT_RESPONSE_JSON_SCHEMA,
    },
  };
}

function usageFromResult(msg: SDKMessage): TokenUsage | null {
  if (msg.type !== "result" || !("usage" in msg) || !msg.usage) return null;
  const u = msg.usage as {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
  };
}

function captureResultMeta(
  msg: SDKMessage,
  boxes: {
    usage: { current: TokenUsage | null };
    costUsd: { current: number | null };
    sdkDurationMs: { current: number | null };
    numTurns: { current: number | null };
    stopReason: { current: string | null };
    model: { current: string | null };
  },
): void {
  boxes.usage.current = usageFromResult(msg);
  if ("total_cost_usd" in msg && typeof msg.total_cost_usd === "number") {
    boxes.costUsd.current = msg.total_cost_usd;
  }
  if ("duration_ms" in msg && typeof msg.duration_ms === "number") {
    boxes.sdkDurationMs.current = msg.duration_ms;
  }
  if ("num_turns" in msg && typeof msg.num_turns === "number") {
    boxes.numTurns.current = msg.num_turns;
  }
  if ("stop_reason" in msg && typeof (msg as { stop_reason?: unknown }).stop_reason === "string") {
    boxes.stopReason.current = (msg as { stop_reason: string }).stop_reason;
  }
  if (
    "modelUsage" in msg &&
    msg.modelUsage &&
    typeof msg.modelUsage === "object"
  ) {
    const keys = Object.keys(msg.modelUsage as Record<string, unknown>);
    if (keys[0]) boxes.model.current = keys[0];
  }
}

function buildStreamEvents(args: {
  parsed: ReturnType<typeof parseAgentResponse>;
  grounding: ReturnType<typeof groundResponse>;
  machineState?: MachineState;
}): StreamEvent[] {
  const { parsed, grounding, machineState } = args;
  const events: StreamEvent[] = [];

  // Grounding status (e.g. "Grounded with uncertainty") is a system state,
  // not user-facing prose — it lives only in the Grounding & Evidence panel
  // (via the separate "grounding" stream event below), never prepended to
  // the chat answer itself.
  let displayText: string;
  if (!grounding.allowedToShow) {
    displayText =
      "I can't walk you through that safely.\n\n" +
      grounding.blockers.map((b) => `- ${b}`).join("\n") +
      "\n\nCheck the safety and maintenance sections of owner-manual.pdf, or have a qualified technician handle this step.";
  } else {
    displayText = formatAnswerWithExtras(parsed.response);
  }

  for (const chunk of chunkText(displayText)) {
    events.push({ type: "text_delta", delta: chunk });
  }

  const artifactSpec = parsed.response.artifact ?? null;

  if (artifactSpec) {
    events.push({
      type: "artifact",
      artifact: { id: createId(), spec: artifactSpec },
    });
  }

  if (parsed.response.citations.length > 0) {
    events.push({ type: "evidence", citations: parsed.response.citations });
  }

  events.push({ type: "grounding", grounding });

  if (parsed.response.diagnosticState && machineState) {
    events.push({
      type: "state_update",
      machineState: {
        ...machineState,
        symptoms: parsed.response.diagnosticState.symptoms,
        hypotheses: parsed.response.diagnosticState.hypotheses,
        askedQuestions: parsed.response.diagnosticState.askedQuestions,
      },
    });
  }

  if (parsed.recovered) {
    events.push({
      type: "text_delta",
      delta: "\n\n(This answer was reconstructed from partial output — worth a follow-up question if anything looks off.)",
    });
  }

  events.push({ type: "done", messageId: createId() });
  return events;
}

function preferToolArtifact(
  parsed: ReturnType<typeof parseAgentResponse>,
  ctx: AgentContext,
): void {
  if (ctx.artifacts.length > 0) {
    parsed.response.artifact = ctx.artifacts[ctx.artifacts.length - 1] ?? null;
  }
}

type EarlyPolicyDecision =
  | { kind: "safety"; response: AgentResponse }
  | { kind: "configuration"; response: AgentResponse; fields: ConfigurationField[] };

function genericEmptyInputResponse(intent: AgentIntent, question: string): AgentResponse {
  return {
    intent,
    answer: "I'd like to help with that — could you give me a bit more detail?",
    clarifyingQuestion: question,
    artifact: null,
    citations: [],
    safetyNotices: [],
    confidence: "medium",
    suggestedActions: [],
    diagnosticState: null,
  };
}

/**
 * Deterministic pre-LLM check using the ClarificationPolicy. Returns null
 * when the request should go to the agent normally (information-level
 * requests, or configuration requests that already have what they need).
 * Near-empty/garbage input is handled first regardless of level.
 */
function earlyPolicyDecision(
  intent: AgentIntent,
  message: string,
  machineState?: MachineState,
): EarlyPolicyDecision | null {
  const emptyInputQuestion = immediateClarificationQuestion(message);
  if (emptyInputQuestion) {
    return {
      kind: "configuration",
      response: genericEmptyInputResponse(intent, emptyInputQuestion),
      fields: [],
    };
  }

  const policyInput = { message, intent, machineState };
  const level = clarificationLevel(policyInput);

  if (level === "safety") {
    return { kind: "safety", response: buildSafetyBlockedResponse() };
  }

  if (level === "configuration") {
    const fields = requiredMissingFields(policyInput);
    if (fields.length > 0) {
      return {
        kind: "configuration",
        response: buildConfigurationClarificationResponse(intent, fields),
        fields,
      };
    }
  }

  return null;
}

/**
 * Deterministic "blocked_for_safety" grounding for safety-critical requests
 * caught by the ClarificationPolicy. Built directly rather than through
 * groundResponse()'s claim-text heuristics, which are tuned for specific
 * manual phrasing and can miss short imperative requests like "bypass
 * safety" or "live electrical work".
 */
function safetyBlockedGrounding(userMessage: string): GroundingResult {
  const blocker =
    "Cannot provide guidance for bypassing safety interlocks, live/energized electrical work, or other dangerous maintenance procedures.";
  return {
    status: "blocked_for_safety",
    coverage: {
      claimsMade: 0,
      directEvidence: 0,
      indirectEvidence: 0,
      calculatedEvidence: 0,
      unsupportedClaims: 0,
      coverageScore: 0,
    },
    howReached: {
      manualFactsUsed: [],
      userObservations: [userMessage.slice(0, 200)],
      hypothesesConsidered: [],
      contradictionsFound: [],
      confidenceLimitations: [],
    },
    blockers: [blocker],
    warnings: [],
    claims: [],
    statusMessage: `${STATUS_LABELS.blocked_for_safety}: ${blocker}`,
    allowedToShow: false,
    citations: [],
  };
}

function finishWithSafetyBlock(args: {
  response: AgentResponse;
  message: string;
  machineState?: MachineState;
}): {
  parsed: ReturnType<typeof parseAgentResponse>;
  grounding: GroundingResult;
  events: StreamEvent[];
} {
  const parsed = { response: args.response, recovered: false, recoveryNotes: [] as string[] };
  const grounding = safetyBlockedGrounding(args.message);
  return {
    parsed,
    grounding,
    events: buildStreamEvents({ parsed, grounding, machineState: args.machineState }),
  };
}

/**
 * Deterministic "clarification_required" grounding for configuration
 * requests missing detail. Built directly — rather than through
 * groundResponse()'s claim-text heuristics — because the clarifying
 * question itself (e.g. listing MIG / Flux-Core / TIG / Stick as options)
 * would otherwise trip claim-conflict detectors tuned for model-generated
 * technical prose, not a deterministic multiple-choice prompt.
 */
function configurationClarificationGrounding(
  userMessage: string,
  fields: ConfigurationField[],
): GroundingResult {
  const reasons = missingFieldReasons(fields);
  return {
    status: "clarification_required",
    coverage: {
      claimsMade: 0,
      directEvidence: 0,
      indirectEvidence: 0,
      calculatedEvidence: 0,
      unsupportedClaims: 0,
      coverageScore: 0,
    },
    howReached: {
      manualFactsUsed: [],
      userObservations: [userMessage.slice(0, 200)],
      hypothesesConsidered: [],
      contradictionsFound: [],
      reasonForNextQuestion: reasons[0],
      confidenceLimitations: [],
    },
    blockers: [],
    warnings: [],
    claims: [],
    statusMessage: reasons[0]
      ? `${STATUS_LABELS.clarification_required}: ${reasons[0]}`
      : STATUS_LABELS.clarification_required,
    allowedToShow: true,
    citations: [],
  };
}

function finishWithConfigurationClarification(args: {
  response: AgentResponse;
  message: string;
  machineState?: MachineState;
  fields: ConfigurationField[];
}): {
  parsed: ReturnType<typeof parseAgentResponse>;
  grounding: GroundingResult;
  events: StreamEvent[];
} {
  const parsed = { response: args.response, recovered: false, recoveryNotes: [] as string[] };
  const grounding = configurationClarificationGrounding(args.message, args.fields);
  return {
    parsed,
    grounding,
    events: buildStreamEvents({ parsed, grounding, machineState: args.machineState }),
  };
}

/**
 * Attaches the ClarificationPolicy's one optional, non-blocking follow-up
 * to an information-level answer — without touching `clarifyingQuestion`
 * (which would flip grounding to "clarification_required" and reintroduce
 * the exact "shows a label, then answers anyway" contradiction this policy
 * exists to remove).
 */
function attachOptionalFollowUp(
  response: AgentResponse,
  message: string,
  intent: AgentIntent,
  machineState?: MachineState,
): AgentResponse {
  if (response.clarifyingQuestion) return response;
  const policyInput = { message, intent, machineState };
  if (clarificationLevel(policyInput) !== "information") return response;
  const followUp = optionalFollowUp(policyInput);
  if (!followUp) return response;
  if (/which (?:welding )?process/i.test(response.answer)) return response;
  return { ...response, answer: `${response.answer}\n\n${followUp}` };
}

/** True for SDK failures that are just the turn budget running out — as
 * opposed to genuine infrastructure failures (bad API key, network). These
 * are always recoverable into a grounded answer and must never surface the
 * raw SDK error string to the user. */
function isMaxTurnsError(errorKind: string | null, errorText: string): boolean {
  return (
    errorKind === "error_max_turns" ||
    /maximum number of turns/i.test(errorText)
  );
}

/**
 * When the SDK stops before emitting clean structured output (almost always
 * the per-intent turn cap), always produce a graceful, grounded response —
 * the raw SDK error is never shown to the user. Prefers, in order:
 *   1. any usable partial answer the model already produced,
 *   2. the manual evidence gathered by pre-fetch / tools (citations + artifact),
 *   3. a friendly, honest retry prompt (never a guess, never a raw error).
 */
function buildMaxTurnsResponse(
  ctx: AgentContext,
  intent: AgentIntent,
  message: string,
  rawOutput: string,
): AgentResponse {
  // 1. Recover a real partial answer if the model produced usable structured text.
  if (rawOutput.trim()) {
    const parsed = parseAgentResponse(rawOutput, ctx, intent);
    if (!parsed.recovered && parsed.response.answer.trim()) {
      preferToolArtifact(parsed, ctx);
      return parsed.response;
    }
  }

  // 2. Evidence-based salvage from gathered citations / artifacts.
  if (ctx.citations.length > 0 || ctx.artifacts.length > 0) {
    const pages = [...new Set(ctx.citations.map((c) => `p.${c.page}`))].slice(0, 4);
    const pageRef = pages.length ? ` (${pages.join(", ")})` : "";
    return {
      intent,
      answer: `Here's the best-supported guidance I have from the OmniPro 220 manual${pageRef} for "${message.slice(0, 120)}". Open the workspace artifact and citations for the specifics — and feel free to ask a more focused follow-up.`,
      clarifyingQuestion: null,
      artifact: ctx.artifacts[ctx.artifacts.length - 1] ?? null,
      citations: ctx.citations.slice(0, 8),
      safetyNotices: [],
      confidence: "medium",
      suggestedActions: ctx.toolSummaries.slice(-3),
      diagnosticState: null,
    };
  }

  // 3. Nothing gathered — honest retry prompt. Never leak the raw SDK error.
  return {
    intent,
    answer:
      "I couldn't finish working through that one in time. Try asking again, or add a detail or two — the welding process, input voltage, or material and thickness — so I can zero in faster. I keep every answer grounded in the OmniPro 220 manual, so I'd rather ask again than guess.",
    clarifyingQuestion: null,
    artifact: null,
    citations: [],
    safetyNotices: [],
    confidence: "low",
    suggestedActions: ctx.toolSummaries.slice(-3),
    diagnosticState: null,
  };
}

function finishWithResponse(args: {
  response: AgentResponse;
  message: string;
  machineState?: MachineState;
  toolSummaries: string[];
}): {
  parsed: ReturnType<typeof parseAgentResponse>;
  grounding: ReturnType<typeof groundResponse>;
  events: StreamEvent[];
} {
  const parsed = {
    response: args.response,
    recovered: false,
    recoveryNotes: [] as string[],
  };
  const grounding = groundResponse({
    response: args.response,
    userMessage: args.message,
    machineState: args.machineState,
    toolSummaries: args.toolSummaries,
  });
  return {
    parsed,
    grounding,
    events: buildStreamEvents({
      parsed,
      grounding,
      machineState: args.machineState,
    }),
  };
}

export async function* runWeldPilotAgent(
  params: RunAgentParams,
): AsyncGenerator<StreamEvent> {
  const { mode, message, machineState } = params;
  const queryFn = params.queryFn ?? defaultQueryFn;
  const intent = classifyIntent(message, mode, machineState);
  const ctx = createAgentContext();
  const model = resolveAgentModel();

  const earlyDecision = earlyPolicyDecision(intent, message, machineState);
  if (earlyDecision) {
    yield { type: "progress", message: "Preparing your answer", icon: "reasoning" };
    const finished =
      earlyDecision.kind === "safety"
        ? finishWithSafetyBlock({ response: earlyDecision.response, message, machineState })
        : finishWithConfigurationClarification({
            response: earlyDecision.response,
            message,
            machineState,
            fields: earlyDecision.fields,
          });
    for (const event of finished.events) yield event;
    return;
  }

  // Perceived-latency: acknowledge the request within ~1s, before the
  // (parallel, deterministic) pre-fetch and the Claude call even start.
  // These are transient progress events, not chat text — the client renders
  // them in a dedicated status component above the streaming answer.
  yield { type: "progress", message: "Searching the owner manual", icon: "search" };

  const prefetch = await runDeterministicPrefetch(ctx, intent, message, machineState);
  const foundSummary = summarizePrefetchFinding(prefetch);
  if (foundSummary) {
    yield { type: "progress", message: foundSummary, icon: "found" };
  }
  let announcedArtifacts = 0;
  for (const artifact of ctx.artifacts.slice(announcedArtifacts)) {
    yield { type: "progress", ...artifactProgressStep(artifact) };
  }
  announcedArtifacts = ctx.artifacts.length;

  yield { type: "progress", message: "Preparing your answer", icon: "reasoning" };

  const apiKey = params.apiKey ?? getEnv().ANTHROPIC_API_KEY;
  const userPrompt = buildUserPrompt(
    message,
    mode,
    intent,
    machineState,
    formatPrefetchedContext(prefetch),
  );
  const options = buildQueryOptions(mode, intent, ctx, apiKey, model);

  let rawOutput = "";
  let lastToolStatus = "";
  let runError: string | null = null;
  let runErrorKind: string | null = null;

  const q = queryFn({ prompt: userPrompt, options });

  try {
    for await (const msg of q) {
      if (msg.type === "tool_progress") {
        const shortName = shortToolName(msg.tool_name);
        const step = PROGRESS_BY_TOOL[shortName];
        if (step && step.message !== lastToolStatus) {
          lastToolStatus = step.message;
          yield { type: "progress", message: step.message, icon: step.icon };
        }
      }

      if (msg.type === "assistant") {
        const text = extractTextFromMessage(msg);
        if (text) rawOutput = text;
      }

      if (msg.type === "result") {
        if (msg.subtype === "success") {
          rawOutput = extractTextFromMessage(msg) || rawOutput;
        } else {
          runError =
            "result" in msg && typeof msg.result === "string"
              ? msg.result
              : "Agent run failed";
          runErrorKind = msg.subtype ?? null;
        }
      }
    }
  } catch (err) {
    // The Agent SDK reports a hit turn cap by throwing (e.g. "Claude Code
    // returned an error result: Reached maximum number of turns (N)"), not by
    // yielding an error result message — so this catch is what actually keeps
    // that raw string from reaching the SSE route and the user.
    runError = err instanceof Error ? err.message : "Agent run failed";
  } finally {
    q.close();
  }

  if (runError) {
    const recoverable =
      isMaxTurnsError(runErrorKind, runError) ||
      ctx.citations.length > 0 ||
      ctx.artifacts.length > 0;

    if (recoverable) {
      const salvaged = buildMaxTurnsResponse(ctx, intent, message, rawOutput);
      const finished = finishWithResponse({
        response: salvaged,
        message,
        machineState,
        toolSummaries: ctx.toolSummaries,
      });
      for (const event of finished.events) yield event;
      return;
    }

    // Genuine infrastructure failure with nothing to salvage — surface a
    // clean, user-facing message, never the raw SDK/internal error string.
    yield {
      type: "error",
      message:
        "WeldPilot hit a problem reaching the reasoning service. Please try again in a moment.",
    };
    return;
  }

  const parsed = parseAgentResponse(rawOutput, ctx, intent);
  preferToolArtifact(parsed, ctx);
  parsed.response = attachOptionalFollowUp(parsed.response, message, intent, machineState);

  if (ctx.artifacts.length > announcedArtifacts) {
    for (const artifact of ctx.artifacts.slice(announcedArtifacts)) {
      yield { type: "progress", ...artifactProgressStep(artifact) };
    }
    announcedArtifacts = ctx.artifacts.length;
  } else if (parsed.response.artifact && announcedArtifacts === 0) {
    yield { type: "progress", ...artifactProgressStep(parsed.response.artifact) };
  }

  const grounding = groundResponse({
    response: parsed.response,
    userMessage: message,
    machineState,
    toolSummaries: ctx.toolSummaries,
  });

  for (const event of buildStreamEvents({ parsed, grounding, machineState })) {
    yield event;
  }
}

/**
 * Instrumented live/agent run used by validation harnesses.
 * Collects tool calls, usage/cost, grounding, and parse-fallback without logging secrets.
 */
export async function runWeldPilotAgentInstrumented(
  params: RunAgentParams,
): Promise<InstrumentedAgentResult> {
  const started = Date.now();
  const toolCalls: ToolCallRecord[] = [];
  const modelInvocations: ModelInvocationRecord[] = [];
  const usageBox = { current: null as TokenUsage | null };
  const costBox = { current: null as number | null };
  const sdkDurationBox = { current: null as number | null };
  const numTurnsBox = { current: null as number | null };
  const stopReasonBox = { current: null as string | null };
  const modelBox = { current: null as string | null };

  const events: StreamEvent[] = [];
  let error: string | null = null;
  let errorKind: string | null = null;
  let grounding: InstrumentedAgentResult["grounding"] = null;
  let response: InstrumentedAgentResult["response"] = null;
  let artifact: InstrumentedAgentResult["artifact"] = null;
  let parseFallback = false;
  let recoveryNotes: string[] = [];
  let clarifyingQuestion: string | null = null;
  let confidence: AgentRunTelemetry["confidence"] = null;
  let toolSummaries: string[] = [];
  let timeToFirstTokenMs: number | null = null;
  let assistantTurn = 0;
  let turnStartedAt = started;
  let groundingMs = 0;
  let renderingMs = 0;

  const { mode, message, machineState } = params;
  const queryFn = params.queryFn ?? defaultQueryFn;
  const routingStart = Date.now();
  const intent = classifyIntent(message, mode, machineState);
  const ctx = createAgentContext();
  const model = resolveAgentModel();
  modelBox.current = model;

  const earlyDecision = earlyPolicyDecision(intent, message, machineState);
  const routingMs = Date.now() - routingStart;
  if (earlyDecision) {
    const recoveryNote =
      earlyDecision.kind === "safety" ? "deterministic_safety_block" : "deterministic_clarification";
    events.push({ type: "progress", message: "Preparing your answer", icon: "reasoning" });
    const renderStart = Date.now();
    const finished =
      earlyDecision.kind === "safety"
        ? finishWithSafetyBlock({ response: earlyDecision.response, message, machineState })
        : finishWithConfigurationClarification({
            response: earlyDecision.response,
            message,
            machineState,
            fields: earlyDecision.fields,
          });
    renderingMs = Date.now() - renderStart;
    events.push(...finished.events);
    response = finished.parsed.response;
    clarifyingQuestion = finished.parsed.response.clarifyingQuestion ?? null;
    confidence = finished.parsed.response.confidence;
    grounding = finished.grounding;
    artifact = finished.parsed.response.artifact ?? null;
    const telemetry: AgentRunTelemetry = {
      latencyMs: Date.now() - started,
      sdkDurationMs: 0,
      timeToFirstTokenMs: Date.now() - started,
      model,
      modelInvocations: [],
      toolCalls: [],
      toolSummaries: [],
      toolExecutionMs: 0,
      retrievalMs: 0,
      safetyReviewMs: 0,
      artifactGenerationMs: 0,
      groundingMs: 0,
      routingMs,
      prefetchMs: 0,
      renderingMs,
      waterfall: buildWaterfall({
        routingMs,
        prefetchPhases: [],
        modelInvocations: [],
        safetyReviewMs: 0,
        artifactGenerationMs: 0,
        groundingMs: 0,
        renderingMs,
      }),
      citations: response.citations,
      artifactType: artifact?.type ?? null,
      artifactValid: true,
      groundingStatus: grounding.status,
      groundingAllowed: grounding.allowedToShow,
      confidence,
      clarifyingQuestion,
      safetyOutcome: safetyOutcomeFromGrounding(grounding),
      parseFallback: false,
      recoveryNotes: [recoveryNote],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      },
      effectiveInputTokens: 0,
      totalCostUsd: 0,
      numTurns: 0,
      retryCount: 0,
      stopReason: recoveryNote,
      streamEventTypes: events.map((e) => e.type),
      textLength: events
        .filter((e) => e.type === "text_delta")
        .map((e) => (e.type === "text_delta" ? e.delta : ""))
        .join("").length,
      error: null,
    };
    return { events, telemetry, response, grounding, artifact };
  }

  const prefetchStart = Date.now();
  events.push({ type: "progress", message: "Searching the owner manual", icon: "search" });
  const prefetch: PrefetchOutcome = await runDeterministicPrefetch(
    ctx,
    intent,
    message,
    machineState,
  );
  const foundSummary = summarizePrefetchFinding(prefetch);
  if (foundSummary) {
    events.push({ type: "progress", message: foundSummary, icon: "found" });
  }
  let announcedArtifacts = 0;
  for (const prefetchedArtifact of ctx.artifacts.slice(announcedArtifacts)) {
    events.push({ type: "progress", ...artifactProgressStep(prefetchedArtifact) });
  }
  announcedArtifacts = ctx.artifacts.length;
  events.push({ type: "progress", message: "Preparing your answer", icon: "reasoning" });
  const prefetchMs = Date.now() - prefetchStart;

  const apiKey = params.apiKey ?? getEnv().ANTHROPIC_API_KEY;
  const userPrompt = buildUserPrompt(
    message,
    mode,
    intent,
    machineState,
    formatPrefetchedContext(prefetch),
  );
  const options = buildQueryOptions(mode, intent, ctx, apiKey, model);

  let rawOutput = "";
  let lastToolStatus = "";
  const q = queryFn({ prompt: userPrompt, options });

  try {
    for await (const msg of q) {
      if (msg.type === "tool_progress") {
        if (timeToFirstTokenMs == null) {
          timeToFirstTokenMs = Date.now() - started;
        }
        const shortName = shortToolName(msg.tool_name);
        const step = PROGRESS_BY_TOOL[shortName];
        if (step && step.message !== lastToolStatus) {
          lastToolStatus = step.message;
          events.push({ type: "progress", message: step.message, icon: step.icon });
        }
      }

      if (msg.type === "assistant") {
        if (timeToFirstTokenMs == null) {
          timeToFirstTokenMs = Date.now() - started;
        }
        const endMs = Date.now();
        assistantTurn += 1;
        modelInvocations.push({
          model: modelBox.current ?? model,
          turn: assistantTurn,
          startMs: turnStartedAt - started,
          endMs: endMs - started,
          latencyMs: endMs - turnStartedAt,
          stopReason: null,
        });
        turnStartedAt = endMs;

        const text = extractTextFromMessage(msg);
        if (text) rawOutput = text;
        const calls = extractToolCallsFromAssistantContent(msg.message?.content);
        for (const call of calls) {
          const durationMs = ctx.timings.byTool[call.name];
          toolCalls.push(
            durationMs != null ? { ...call, durationMs } : call,
          );
        }
      }

      if (msg.type === "result") {
        captureResultMeta(msg, {
          usage: usageBox,
          costUsd: costBox,
          sdkDurationMs: sdkDurationBox,
          numTurns: numTurnsBox,
          stopReason: stopReasonBox,
          model: modelBox,
        });
        if (msg.subtype === "success") {
          rawOutput = extractTextFromMessage(msg) || rawOutput;
        } else {
          error =
            "result" in msg && typeof msg.result === "string"
              ? msg.result
              : "Agent run failed";
          errorKind = msg.subtype ?? null;
          // Do not push the raw error event here — the post-loop recovery
          // block decides whether to salvage a grounded answer instead.
        }
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Agent run failed";
  } finally {
    q.close();
  }

  if (!error) {
    const parsed = parseAgentResponse(rawOutput, ctx, intent);
    preferToolArtifact(parsed, ctx);
    parsed.response = attachOptionalFollowUp(parsed.response, message, intent, machineState);
    parseFallback = parsed.recovered;
    recoveryNotes = parsed.recoveryNotes;
    response = parsed.response;
    clarifyingQuestion = parsed.response.clarifyingQuestion ?? null;
    confidence = parsed.response.confidence;
    toolSummaries = [...ctx.toolSummaries];
    artifact = parsed.response.artifact ?? null;

    if (ctx.artifacts.length > announcedArtifacts) {
      for (const newArtifact of ctx.artifacts.slice(announcedArtifacts)) {
        events.push({ type: "progress", ...artifactProgressStep(newArtifact) });
      }
      announcedArtifacts = ctx.artifacts.length;
    } else if (artifact && announcedArtifacts === 0) {
      events.push({ type: "progress", ...artifactProgressStep(artifact) });
    }

    const groundStart = Date.now();
    grounding = groundResponse({
      response: parsed.response,
      userMessage: message,
      machineState,
      toolSummaries: ctx.toolSummaries,
    });
    groundingMs = Date.now() - groundStart;

    const renderStart = Date.now();
    events.push(...buildStreamEvents({ parsed, grounding, machineState }));
    renderingMs = Date.now() - renderStart;
  } else {
    const recoverable =
      isMaxTurnsError(errorKind, error) ||
      ctx.citations.length > 0 ||
      ctx.artifacts.length > 0;

    if (recoverable) {
      const salvaged = buildMaxTurnsResponse(ctx, intent, message, rawOutput);
      recoveryNotes.push("max_turns_salvage");
      const renderStart = Date.now();
      const finished = finishWithResponse({
        response: salvaged,
        message,
        machineState,
        toolSummaries: ctx.toolSummaries,
      });
      renderingMs = Date.now() - renderStart;
      response = salvaged;
      clarifyingQuestion = salvaged.clarifyingQuestion ?? null;
      confidence = salvaged.confidence;
      toolSummaries = [...ctx.toolSummaries];
      artifact = salvaged.artifact ?? null;
      grounding = finished.grounding;
      groundingMs = 0;
      error = null;
      events.push(...finished.events);
    } else {
      // Genuine infrastructure failure with nothing to salvage — clean,
      // user-facing message rather than the raw SDK/internal error string.
      events.push({
        type: "error",
        message:
          "WeldPilot hit a problem reaching the reasoning service. Please try again in a moment.",
      });
    }
  }

  const textLength = events
    .filter((e) => e.type === "text_delta")
    .map((e) => (e.type === "text_delta" ? e.delta : ""))
    .join("").length;

  const artifactValid = artifact ? validateArtifactSpec(artifact) !== null : true;

  // Attach measured durations onto tool call records when missing
  for (const call of toolCalls) {
    if (call.durationMs == null && ctx.timings.byTool[call.name] != null) {
      call.durationMs = ctx.timings.byTool[call.name];
    }
  }

  const telemetry: AgentRunTelemetry = {
    latencyMs: Date.now() - started,
    sdkDurationMs: sdkDurationBox.current,
    timeToFirstTokenMs,
    model: modelBox.current,
    modelInvocations,
    toolCalls,
    toolSummaries,
    toolExecutionMs: ctx.timings.toolExecutionMs,
    retrievalMs: ctx.timings.retrievalMs,
    safetyReviewMs: ctx.timings.safetyReviewMs,
    artifactGenerationMs: ctx.timings.artifactGenerationMs,
    groundingMs,
    routingMs,
    prefetchMs,
    renderingMs,
    waterfall: buildWaterfall({
      routingMs,
      prefetchPhases: prefetch.phases,
      modelInvocations,
      safetyReviewMs: ctx.timings.safetyReviewMs,
      artifactGenerationMs: ctx.timings.artifactGenerationMs,
      groundingMs,
      renderingMs,
    }),
    citations: response?.citations ?? [],
    artifactType: artifact?.type ?? null,
    artifactValid,
    groundingStatus: grounding?.status ?? null,
    groundingAllowed: grounding?.allowedToShow ?? null,
    confidence,
    clarifyingQuestion,
    safetyOutcome: safetyOutcomeFromGrounding(grounding),
    parseFallback,
    recoveryNotes,
    usage: usageBox.current,
    effectiveInputTokens: effectiveInputTokens(usageBox.current),
    totalCostUsd: costBox.current,
    numTurns: numTurnsBox.current,
    retryCount: 0,
    stopReason: stopReasonBox.current,
    streamEventTypes: events.map((e) => e.type),
    textLength,
    error,
  };

  return { events, telemetry, response, grounding, artifact };
}
