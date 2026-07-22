/**
 * Deterministic clarification policy for WeldPilot.
 *
 * Goal: behave like an experienced technician, not an internal state machine.
 * - Informational questions are answered immediately (optionally with one
 *   polite, non-blocking follow-up).
 * - Configuration requests are asked for the minimum missing detail before
 *   any settings/polarity recommendation is generated.
 * - Safety-critical requests are blocked immediately.
 *
 * This module is pure and side-effect free so it is fully unit-testable and
 * usable from both the streaming agent runner and the grounding engine
 * without depending on Claude output.
 */
import type { AgentIntent, AgentResponse } from "@/lib/agent/schemas";
import type { MachineState } from "@/lib/schemas/conversation";

export type ClarificationLevel = "information" | "configuration" | "safety";

export type ConfigurationField = "process" | "material" | "thickness";

export interface ClarificationPolicyInput {
  message: string;
  intent: AgentIntent;
  machineState?: Partial<MachineState>;
}

const PROCESS_PATTERN = /\b(mig|flux[- ]?core|flux|tig|stick|solid core)\b/i;
/**
 * Any material mention — not just ones the manual's settings chart
 * supports. This only gates "did the user tell us a material", so it
 * intentionally also matches unsupported metals (e.g. titanium): the
 * "not supported on this machine" determination belongs to
 * resolveSettings()/grounding downstream, not to this pre-model gate.
 * Asking "what material?" after the user already named one — even an
 * unsupported one — is exactly the robotic, ignore-the-answer behavior
 * this policy exists to avoid.
 */
const MATERIAL_PATTERN =
  /\b(steel|aluminum|aluminium|stainless|titanium|copper|brass|bronze|chrome[- ]?moly|cast iron|nickel|magnesium|inconel|monel|iron|metal|alloy)\b/i;
const THICKNESS_PATTERN = /\d+(?:\/\d+)?\s*(?:"|in\b|inch(?:es)?\b|mm\b)/i;

/** User asks to do something unsafe — block, do not ask a clarifying question. */
const SAFETY_REQUEST_PATTERN =
  /\bbypass\b[^.!?]*\b(?:interlock|safety|door)\b|\b(?:interlock|safety|door)\b[^.!?]*\bbypass\b|\blive electrical work\b|\bdangerous maintenance\b|\bwork(?:ing)? on[^.!?]*\b(?:main |control )?pcb\b[^.!?]*\b(?:powered|energized|plugged in|live)\b|\b(?:energized|live voltage)[^.!?]*\b(?:pcb|interior|panel)\b/i;

/**
 * Pure lookup / explain requests — answerable without any machine context.
 * Deliberately matches on sentence-opening phrasing so overlapping keywords
 * (e.g. "wire feed" also appearing in setup vocabulary) don't get misrouted
 * into a blocking configuration request.
 */
const INFORMATION_REQUEST_PATTERN =
  /^\s*(show me|show|display|what does|what's|what is|explain|describe|where is|where's|how does|tell me about|walk me through)\b/i;

const GENERAL_SETUP_PATTERN = /\bset(?:ting)? (?:the )?machine up\b|\bset up the machine\b/i;
const CABLE_SOCKET_PATTERN =
  /\bwhich (?:cable|socket|lead|wire)\b|\bcable goes where\b|\bwhere does[^.!?]*(?:cable|clamp|torch|electrode)[^.!?]*go\b/i;
const POLARITY_PATTERN = /\bpolarity\b/i;
const CONFIGURE_PROCESS_PATTERN = /\bconfigure\b/i;
const SETTINGS_VALUE_PATTERN =
  /\b(?:what|which)\s+(?:settings?|voltage|amperage|wire speed)\b[^.!?]*\bshould i use\b/i;
const SETTINGS_KEYWORD_PATTERN = /\bsettings?\b|\bwire speed\b|\bwfs\b/i;

/** Determine which of the three clarification levels a request falls into. */
export function clarificationLevel(input: ClarificationPolicyInput): ClarificationLevel {
  const { message, intent } = input;

  if (intent === "safety_critical" || SAFETY_REQUEST_PATTERN.test(message)) {
    return "safety";
  }

  if (INFORMATION_REQUEST_PATTERN.test(message)) {
    return "information";
  }

  const looksLikeConfiguration =
    GENERAL_SETUP_PATTERN.test(message) ||
    CABLE_SOCKET_PATTERN.test(message) ||
    POLARITY_PATTERN.test(message) ||
    CONFIGURE_PROCESS_PATTERN.test(message) ||
    SETTINGS_VALUE_PATTERN.test(message) ||
    intent === "setup" ||
    intent === "settings";

  return looksLikeConfiguration ? "configuration" : "information";
}

function hasProcess(message: string, machineState?: Partial<MachineState>): boolean {
  return Boolean(machineState?.process) || PROCESS_PATTERN.test(message);
}

function hasMaterial(message: string, machineState?: Partial<MachineState>): boolean {
  return Boolean(machineState?.material) || MATERIAL_PATTERN.test(message);
}

function hasThickness(message: string, machineState?: Partial<MachineState>): boolean {
  return Boolean(machineState?.thickness) || THICKNESS_PATTERN.test(message);
}

function isSettingsValueRequest(message: string, intent: AgentIntent): boolean {
  return (
    intent === "settings" ||
    SETTINGS_VALUE_PATTERN.test(message) ||
    SETTINGS_KEYWORD_PATTERN.test(message)
  );
}

/**
 * Minimum fields required before a configuration-level request can be
 * answered with a real recommendation. Empty for information/safety levels.
 */
export function requiredMissingFields(input: ClarificationPolicyInput): ConfigurationField[] {
  if (clarificationLevel(input) !== "configuration") return [];

  const { message, intent, machineState } = input;
  const missing: ConfigurationField[] = [];

  if (!hasProcess(message, machineState)) missing.push("process");

  if (isSettingsValueRequest(message, intent)) {
    if (!hasMaterial(message, machineState)) missing.push("material");
    if (!hasThickness(message, machineState)) missing.push("thickness");
  }

  return missing;
}

/** True only when a configuration request is missing information needed to answer safely. */
export function shouldRequireClarification(input: ClarificationPolicyInput): boolean {
  return (
    clarificationLevel(input) === "configuration" && requiredMissingFields(input).length > 0
  );
}

/**
 * One polite, non-blocking follow-up for information-level requests.
 * Returns null when no follow-up is useful (e.g. process already known).
 */
export function optionalFollowUp(input: ClarificationPolicyInput): string | null {
  if (clarificationLevel(input) !== "information") return null;
  if (hasProcess(input.message, input.machineState)) return null;
  return "If you're setting up a specific process, tell me whether you're using MIG, TIG, Stick, or Flux-Core and I can highlight the controls you'll actually use.";
}

const FIELD_QUESTIONS: Record<ConfigurationField, string> = {
  process: "Which welding process are you using?",
  material: "What material are you welding — mild steel, stainless, or aluminum?",
  thickness: "What's the material thickness (e.g. 1/8 inch)?",
};

const FIELD_REASONS: Record<ConfigurationField, string> = {
  process: "Which welding process you're using changes cable, socket, and polarity guidance.",
  material: "The material changes which settings-chart row applies.",
  thickness: "The thickness changes which settings-chart row applies.",
};

/** Short reason strings used by the grounding engine's "how reached" panel. */
export function missingFieldReasons(fields: ConfigurationField[]): string[] {
  return fields.map((f) => FIELD_REASONS[f]);
}

/** Single-sentence clarifying question for the given missing fields. */
export function buildClarifyingQuestion(fields: ConfigurationField[]): string {
  if (fields.length === 0) return "";
  if (fields.includes("process")) return FIELD_QUESTIONS.process;
  const rest = fields.filter((f) => f !== "process").map((f) => FIELD_QUESTIONS[f]);
  return rest.join(" ");
}

/**
 * Conversational lead-in used in place of the model's answer when a
 * configuration request is missing required detail. Never generates a
 * recommendation — asks for the minimum information first.
 */
export function buildConfigurationClarificationAnswer(fields: ConfigurationField[]): string {
  if (fields.includes("process")) {
    return [
      "I can help configure the machine.",
      "",
      "First, which welding process are you using?",
      "",
      "\u2022 MIG",
      "\u2022 Flux-Core",
      "\u2022 TIG",
      "\u2022 Stick",
    ].join("\n");
  }

  const rest = fields.filter((f) => f !== "process");
  if (rest.length > 0) {
    const asks = rest.map((f) => (f === "material" ? "material" : "thickness"));
    return `Got it — to look up the right settings, what ${asks.join(" and ")} are you working with?`;
  }

  return "I need one more detail before giving specific guidance.";
}

export function buildConfigurationClarificationResponse(
  intent: AgentIntent,
  fields: ConfigurationField[],
): AgentResponse {
  return {
    intent,
    answer: buildConfigurationClarificationAnswer(fields),
    // The conversational answer already asks the question inline — leaving
    // this null avoids formatAnswerWithExtras appending a duplicate
    // "One question that would help" line right under it.
    clarifyingQuestion: null,
    artifact: null,
    citations: [],
    safetyNotices: fields.includes("process")
      ? [
          "Turn the Power Switch OFF and unplug the welder before changing cable connections (owner-manual.pdf).",
        ]
      : [],
    confidence: "medium",
    suggestedActions:
      fields.includes("process")
        ? ["Reply with MIG, Flux-Core, TIG, or Stick"]
        : ["Reply with material and thickness"],
    diagnosticState: null,
  };
}

/** Conversational refusal for safety-critical requests — blocked immediately. */
export function buildSafetyBlockedResponse(): AgentResponse {
  return {
    intent: "safety_critical",
    answer:
      "I can't help with that. Bypassing safety interlocks or working on live/energized components isn't something I can guide you through — it risks serious injury. Power off and fully unplug the welder before any interior or maintenance work, and follow the safety section of owner-manual.pdf.",
    clarifyingQuestion: null,
    artifact: null,
    citations: [],
    safetyNotices: [
      "Turn the Power Switch OFF and unplug the welder before any interior or maintenance work (owner-manual.pdf).",
    ],
    confidence: "high",
    suggestedActions: [],
    diagnosticState: null,
  };
}