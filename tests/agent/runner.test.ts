import { describe, it, expect } from "vitest";
import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { runWeldPilotAgent, type AgentQueryFn } from "@/lib/agent/runner-core";

function mockQuery(messages: SDKMessage[]): AgentQueryFn {
  return () => {
    const q = {
      async *[Symbol.asyncIterator]() {
        for (const msg of messages) yield msg;
      },
      close() {},
    };
    return q as unknown as Query;
  };
}

const validResponse = {
  intent: "calculation",
  answer:
    "On 240V MIG, the manual rates 25% duty cycle at 200A (owner-manual.pdf p.7). Weld about 2.5 minutes per 10, then rest.",
  clarifyingQuestion: null,
  artifact: {
    type: "duty-cycle-calculator",
    title: "MIG Duty Cycle @ 240V",
    process: "mig",
    voltage: 240,
    defaultAmps: 200,
    citations: [{ source: "owner-manual.pdf", page: 7 }],
    confidence: "high",
  },
  citations: [
    {
      source: "owner-manual.pdf",
      page: 7,
      excerpt: "25% @ 200 A",
    },
  ],
  safetyNotices: ["Allow the welder to cool during rest periods."],
  confidence: "high",
  suggestedActions: ["Use duty_cycle_calculator artifact"],
  diagnosticState: null,
};

describe("runWeldPilotAgent (mocked Claude)", () => {
  it("streams structured response events", async () => {
    const messages = [
      {
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 100,
        duration_api_ms: 80,
        num_turns: 2,
        result: JSON.stringify(validResponse),
        structured_output: validResponse,
        stop_reason: "end_turn",
        total_cost_usd: 0,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
        modelUsage: {},
        permission_denials: [],
        uuid: "00000000-0000-4000-8000-000000000001",
        session_id: "00000000-0000-4000-8000-000000000002",
      },
    ] as unknown as SDKMessage[];

    const events = [];
    for await (const event of runWeldPilotAgent({
      mode: "manual",
      message: "MIG duty cycle at 200A 240V?",
      queryFn: mockQuery(messages),
      apiKey: "test-api-key",
    })) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "text_delta")).toBe(true);
    expect(events.some((e) => e.type === "artifact")).toBe(true);
    expect(events.some((e) => e.type === "evidence")).toBe(true);
    expect(events.some((e) => e.type === "grounding")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(true);

    const evidence = events.find((e) => e.type === "evidence");
    if (evidence?.type === "evidence") {
      expect(evidence.citations.some((c) => c.page === 7)).toBe(true);
    }
  });

  it("keeps execution progress out of the assistant message text", async () => {
    const messages = [
      {
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 100,
        duration_api_ms: 80,
        num_turns: 2,
        result: JSON.stringify(validResponse),
        structured_output: validResponse,
        stop_reason: "end_turn",
        total_cost_usd: 0,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
        modelUsage: {},
        permission_denials: [],
        uuid: "00000000-0000-4000-8000-000000000005",
        session_id: "00000000-0000-4000-8000-000000000006",
      },
    ] as unknown as SDKMessage[];

    const events = [];
    for await (const event of runWeldPilotAgent({
      mode: "manual",
      message: "MIG duty cycle at 200A 240V?",
      queryFn: mockQuery(messages),
      apiKey: "test-api-key",
    })) {
      events.push(event);
    }

    // Progress is its own transient event type — the UI renders it in a
    // dedicated status component, never inline with the chat answer.
    expect(events.some((e) => e.type === "progress")).toBe(true);
    for (const e of events) {
      if (e.type === "progress") {
        expect(e.message).not.toMatch(/clarification required/i);
        expect(e.message).not.toMatch(/grounded/i);
      }
    }

    const text = events
      .filter((e) => e.type === "text_delta")
      .map((e) => (e.type === "text_delta" ? e.delta : ""))
      .join("");
    // No internal routing/grounding labels or "Searching manuals..." status
    // lines should ever be interleaved into the assistant message itself.
    expect(text).not.toMatch(/searching/i);
    expect(text).not.toMatch(/\[grounded/i);
    expect(text).not.toMatch(/clarification required/i);
    expect(text).not.toMatch(/\*\*/);
  });

  it("recovers from malformed model JSON", async () => {
    const messages = [
      {
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 50,
        duration_api_ms: 40,
        num_turns: 1,
        result: "Sorry, here is plain text without JSON.",
        stop_reason: "end_turn",
        total_cost_usd: 0,
        usage: {
          input_tokens: 5,
          output_tokens: 10,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
        modelUsage: {},
        permission_denials: [],
        uuid: "00000000-0000-4000-8000-000000000003",
        session_id: "00000000-0000-4000-8000-000000000004",
      },
    ] as unknown as SDKMessage[];

    const events = [];
    for await (const event of runWeldPilotAgent({
      mode: "manual",
      message: "help",
      queryFn: mockQuery(messages),
      apiKey: "test-api-key",
    })) {
      events.push(event);
    }

    expect(events.some((e) => e.type === "done")).toBe(true);
    const text = events
      .filter((e) => e.type === "text_delta")
      .map((e) => (e.type === "text_delta" ? e.delta : ""))
      .join("");
    expect(text).toContain("could not verify a structured answer");
  });
});
