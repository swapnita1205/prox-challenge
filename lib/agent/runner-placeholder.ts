/**
 * Placeholder agent runner when ANTHROPIC_API_KEY is not configured.
 */
import type { WeldMode } from "@/lib/schemas/conversation";
import type { StreamEvent } from "@/lib/schemas/api";
import { getModeWelcomeMessage } from "@/lib/agent/modes";
import type { AgentResponse } from "@/lib/agent/schemas";

export async function* runPlaceholderAgent(
  mode: WeldMode,
  userMessage: string,
): AsyncGenerator<StreamEvent> {
  const welcome = getModeWelcomeMessage(mode);
  const placeholderAnswer = buildPlaceholderResponse(mode, userMessage);

  const agentResponse: AgentResponse = {
    intent: mode === "setup" ? "setup" : mode === "diagnose" ? "troubleshooting" : "manual_question",
    answer: placeholderAnswer,
    clarifyingQuestion: null,
    artifact: null,
    citations: [],
    safetyNotices: [],
    confidence: "low",
    suggestedActions: [],
    diagnosticState: null,
  };

  yield { type: "text_delta", delta: placeholderAnswer };

  yield {
    type: "grounding",
    grounding: {
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
        confidenceLimitations: [
          "Placeholder mode — connect ANTHROPIC_API_KEY for live manual retrieval and artifacts.",
        ],
      },
      blockers: [],
      warnings: [],
      claims: [],
      statusMessage: "API key not configured — placeholder response only",
      allowedToShow: true,
      citations: [],
    },
  };

  yield { type: "done", messageId: `msg-${Date.now()}` };

  void welcome;
  void agentResponse;
}

function buildPlaceholderResponse(mode: WeldMode, userMessage: string): string {
  const truncated =
    userMessage.length > 80 ? `${userMessage.slice(0, 80)}…` : userMessage;

  return (
    `I received your ${mode} message: "${truncated}"\n\n` +
    `I can't retrieve manual evidence or build artifacts yet — add ANTHROPIC_API_KEY to .env to turn on live retrieval, citations, and interactive diagrams.`
  );
}
