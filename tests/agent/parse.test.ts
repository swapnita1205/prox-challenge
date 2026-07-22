import { describe, it, expect } from "vitest";
import { createAgentContext } from "@/lib/agent/context";
import { parseAgentResponse } from "@/lib/agent/parse";

describe("parseAgentResponse", () => {
  it("parses valid JSON response", () => {
    const ctx = createAgentContext();
    const raw = JSON.stringify({
      intent: "manual_question",
      answer: "MIG duty cycle at 200A on 240V is 25% per owner-manual.pdf p.7.",
      clarifyingQuestion: null,
      artifact: null,
      citations: [
        {
          source: "owner-manual.pdf",
          page: 7,
          section: "Specifications",
          excerpt: "25% @ 200 A",
        },
      ],
      safetyNotices: [],
      confidence: "high",
      suggestedActions: ["Allow rest period after sustained arc time"],
      diagnosticState: null,
    });

    const result = parseAgentResponse(raw, ctx, "manual_question");
    expect(result.recovered).toBe(false);
    expect(result.response.answer).toContain("25%");
    expect(result.response.citations).toHaveLength(1);
  });

  it("recovers JSON from markdown fences", () => {
    const ctx = createAgentContext();
    const raw = `Here is the answer:
\`\`\`json
{
  "intent": "setup",
  "answer": "Plug ground clamp into negative socket for MIG solid core DCEP.",
  "citations": [],
  "safetyNotices": ["Turn off power before connecting cables."],
  "confidence": "medium",
  "suggestedActions": []
}
\`\`\``;

    const result = parseAgentResponse(raw, ctx, "setup");
    expect(result.response.intent).toBe("setup");
    expect(result.response.safetyNotices.length).toBe(1);
  });

  it("falls back when JSON is malformed", () => {
    const ctx = createAgentContext();
    ctx.citations.push({
      source: "owner-manual.pdf",
      page: 7,
      excerpt: "duty cycle",
    });

    const result = parseAgentResponse("not json at all", ctx, "calculation");
    expect(result.recovered).toBe(true);
    expect(result.response.answer).toContain("could not verify a structured answer");
    expect(result.response.citations).toHaveLength(1);
    expect(result.response.confidence).toBe("low");
  });

  it("merges tool citations with model citations", () => {
    const ctx = createAgentContext();
    ctx.citations.push({ source: "owner-manual.pdf", page: 24, excerpt: "TIG setup" });

    const raw = JSON.stringify({
      intent: "setup",
      answer: "TIG ground clamp goes to positive socket.",
      citations: [{ source: "owner-manual.pdf", page: 24 }],
      safetyNotices: [],
      confidence: "high",
      suggestedActions: [],
    });

    const result = parseAgentResponse(raw, ctx, "setup");
    expect(result.response.citations.length).toBeGreaterThanOrEqual(1);
  });
});
