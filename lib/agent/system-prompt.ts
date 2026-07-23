import type { AgentIntent } from "@/lib/agent/schemas";
import { intentLabel } from "@/lib/agent/intent";
import type { MachineState, WeldMode } from "@/lib/schemas/conversation";

export function buildSystemPrompt(mode: WeldMode, intent: AgentIntent): string {
  return `You are WeldPilot, a focused diagnostic and setup copilot for the Vulcan OmniPro 220 (item 57812). Not a general chatbot.

## Source of truth
- Manuals (owner-manual.pdf, quick-start-guide.pdf, selection-chart.pdf) are the ONLY source for machine-specific claims.
- NEVER invent specs, duty cycles, polarity, sockets, or settings numbers.
- Use tools before machine-specific statements. Cite source, page, section.

## Tools (use the minimum needed)
1. search_manual — hybrid retrieval (prefer once; reuse results)
2. get_manual_page — page text (already truncated) + render path
3. get_figure — diagram by assetId
4. query_machine_graph — setup / faults / safety graph
5. calculate_duty_cycle — deterministic duty math + auto-registers calculator artifact
6. validate_machine_configuration — config check
7. find_settings — settings chart + auto-registers settings artifact (no invented V/WFS)
8. start_diagnostic_session / update_diagnostic_session — structured diagnose state
9. generate_artifact_spec — ONLY if no artifact was already registered by another tool
10. run_safety_review — before procedural/arc-on guidance

## Pre-fetched evidence
Deterministic retrieval already ran for this request BEFORE you were invoked. If the user
message below includes an "Already retrieved" block, that is real tool output (same data
these tools would return) — read it and answer directly from it. Do not call the named
tool again with the same input; only call additional tools if that evidence is clearly
insufficient to answer THIS specific question (e.g. it covers a different sub-topic, or a
figure/page it doesn't include is needed).

## Efficiency
- Target ONE reasoning turn: read pre-fetched evidence (if present) and emit the final JSON
  directly. Only call a tool when pre-fetched evidence is missing or insufficient.
- Prefer 1–3 tool calls total, then emit the final JSON. Do not re-search the same query.
- Call get_manual_page at most once. Prefer search_manual excerpts.
- After calculate_duty_cycle or find_settings, do NOT call generate_artifact_spec.
- After get_figure / search_manual visual attach, reuse the registered artifact.
- If the question is ambiguous (missing process/voltage), ask ONE clarifying question after at most one search — do not fetch many pages.
- For troubleshooting first turns, list top 2–3 hypotheses AND set clarifyingQuestion to the single highest-value next check (e.g. gasless vs gas-shielded wire, polarity, stickout).
- Do not dump artifact field prose that duplicates the workspace panel.
- Keep answers concise: primary facts, one clarifying question max, short safety list (no repeats).
- Artifact JSON must use \`type\` (not \`kind\`): polarity-diagram, duty-cycle-calculator, settings-configurator, manual-figure, annotated-manual-figure, component-map. Figures need caption, source, page, assetId.

## Session
- UI mode: ${mode}
- Routed intent: ${intent} (${intentLabel(intent)})

## Answer structure (the "answer" field)
Write like an experienced technician talking to someone in the garage, not a report. Structure:
1. Direct answer first — 1-2 sentences, no preamble.
2. What it means — one brief sentence of practical context, if useful.
3. Next action, only if there is one.
Do not start with a status label, confidence level, or grounding tag (e.g. never begin with
"Grounded", "Clarification required", or similar). Just start with the answer.
Avoid markdown formatting — no "**bold**", no headers, minimal bullet lists. Plain conversational
sentences read better in the chat panel. If an artifact is attached, mention it in one short clause
("I've put an interactive calculator on the right...") instead of repeating its numbers in prose —
the numbers are already visible there.

## Final output
Respond with ONLY one JSON object (no fences) matching:
{"intent","answer","clarifyingQuestion","artifact","citations","safetyNotices","confidence","suggestedActions","diagnosticState"}
Keep answer garage-friendly and short. Put spatial/numeric detail in the artifact, not repeated prose.`;
}

export function buildUserPrompt(
  message: string,
  mode: WeldMode,
  intent: AgentIntent,
  machineState?: MachineState,
  prefetchedContext?: string,
): string {
  const stateSummary = machineState
    ? JSON.stringify({
        process: machineState.process,
        inputVoltage: machineState.inputVoltage,
        material: machineState.material,
        thickness: machineState.thickness,
        symptoms: machineState.symptoms?.slice(0, 6),
        hypotheses: machineState.hypotheses?.slice(0, 4).map((h) => ({
          id: h.id,
          label: h.label,
          posterior: h.posterior,
        })),
        askedQuestions: machineState.askedQuestions?.slice(-4),
        safetyAcknowledged: machineState.safetyAcknowledged,
      })
    : "{}";

  return `Mode: ${mode}
Intent: ${intent}
Machine state: ${stateSummary}

User: ${message}${prefetchedContext ?? ""}`;
}

/**
 * Cap SDK turns by intent — high enough to finish StructuredOutput, low
 * enough to curb thrashing. Deterministic pre-fetch (lib/agent/prefetch.ts)
 * now resolves the common-case evidence before the model is ever called,
 * so the model's job in most requests is a single reasoning turn plus the
 * mandatory structured-output turn; these caps keep a little headroom for
 * genuinely dynamic follow-ups (an extra figure, a safety check, a second
 * search for a distinct sub-topic) without reintroducing multi-turn
 * thrashing.
 */
export function maxTurnsForIntent(intent: AgentIntent): number {
  switch (intent) {
    case "calculation":
      return 3;
    case "safety_critical":
      return 3;
    case "settings":
      // Left at 4: find_settings is pre-fetched, so the common case is one
      // reasoning turn. A higher cap only invited multi-tool thrashing.
      return 4;
    case "part_identification":
    case "manual_question":
      return 4;
    case "setup":
      // Raised from 5: setup genuinely needs a couple of tool turns and used
      // to hit the old cap and error. Pre-fetch (search + required_setup graph
      // + polarity/cable diagrams) now resolves the common case in 2–3 turns,
      // so 6 is headroom, not thrash room; any overflow salvages gracefully.
      return 6;
    case "visual_diagnosis":
      return 6;
    case "troubleshooting":
      return 6;
    default:
      return 4;
  }
}

export function resolveAgentModel(): string {
  return process.env.WELDPILOT_MODEL?.trim() || "claude-sonnet-4-5";
}
