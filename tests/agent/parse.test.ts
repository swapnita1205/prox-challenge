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

  it("keeps a valid answer when diagnosticState.hypotheses use the wrong field shape", () => {
    const ctx = createAgentContext();
    // The model returned description/confidence/reason instead of label/posterior/evidence.
    const raw = JSON.stringify({
      intent: "troubleshooting",
      answer:
        "For self-shielded flux-core, wrong polarity is the most common cause of porosity.",
      clarifyingQuestion:
        "What polarity are you running right now — electrode positive or negative?",
      citations: [{ source: "owner-manual.pdf", page: 43 }],
      safetyNotices: [],
      confidence: "high",
      suggestedActions: [],
      diagnosticState: {
        sessionId: "porosity-flux-001",
        hypotheses: [
          {
            id: "hyp-polarity",
            description: "Incorrect polarity (DCEP instead of DCEN)",
            confidence: "high",
            reason: "Manual lists polarity as the top porosity cause",
          },
          {
            id: "hyp-contamination",
            description: "Dirty workpiece",
            confidence: "medium",
            reason: "Rust, oil, or mill scale on the base metal",
          },
        ],
      },
    });

    const result = parseAgentResponse(raw, ctx, "troubleshooting");

    // The whole response must survive — not degrade to the generic fallback.
    expect(result.recovered).toBe(false);
    expect(result.response.answer).toContain("porosity");
    expect(result.response.answer).not.toContain("could not verify a structured answer");
    expect(result.response.clarifyingQuestion).toMatch(/polarity/i);

    // Hypotheses were coerced into the schema shape rather than discarded.
    const hyps = result.response.diagnosticState?.hypotheses ?? [];
    expect(hyps).toHaveLength(2);
    expect(hyps[0]).toMatchObject({ id: "hyp-polarity", label: expect.stringContaining("polarity") });
    expect(hyps[0]!.posterior).toBeGreaterThan(0.5);
    expect(hyps[0]!.evidence.length).toBeGreaterThan(0);
    expect(result.recoveryNotes).toContain("diagnostic_hypotheses_coerced");
  });

  it("accepts topHypotheses/likelihood as an alias for hypotheses/posterior", () => {
    const ctx = createAgentContext();
    const raw = JSON.stringify({
      intent: "troubleshooting",
      answer: "Reduce your stickout — it's the likely cause.",
      citations: [{ source: "owner-manual.pdf", page: 43 }],
      safetyNotices: [],
      confidence: "high",
      suggestedActions: [],
      diagnosticState: {
        sessionId: "porosity-002",
        topHypotheses: [
          { id: "hyp-stickout", label: "Excessive stickout", likelihood: "very high" },
        ],
        nextCheck: "surface prep",
      },
    });

    const result = parseAgentResponse(raw, ctx, "troubleshooting");
    expect(result.recovered).toBe(false);
    const hyps = result.response.diagnosticState?.hypotheses ?? [];
    expect(hyps).toHaveLength(1);
    expect(hyps[0]).toMatchObject({ label: "Excessive stickout" });
    expect(hyps[0]!.posterior).toBeGreaterThanOrEqual(0.8);
  });

  it("drops only diagnosticState when it cannot be validated, keeping the answer", () => {
    const ctx = createAgentContext();
    const raw = JSON.stringify({
      intent: "troubleshooting",
      answer: "Here's what to check first.",
      clarifyingQuestion: "What polarity are you on?",
      citations: [],
      safetyNotices: [],
      confidence: "medium",
      suggestedActions: [],
      diagnosticState: "not an object",
    });

    const result = parseAgentResponse(raw, ctx, "troubleshooting");
    expect(result.recovered).toBe(false);
    expect(result.response.answer).toContain("check first");
    expect(result.response.clarifyingQuestion).toMatch(/polarity/i);
    expect(result.response.diagnosticState ?? null).toBeNull();
    expect(result.recoveryNotes).toContain("diagnostic_state_dropped_invalid");
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
