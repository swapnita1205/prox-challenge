import { describe, it, expect } from "vitest";
import { hasValidApiKey } from "@/lib/env";
import { runWeldPilotAgent } from "@/lib/agent/runner-core";

const integrationEnabled = hasValidApiKey();

describe.skipIf(!integrationEnabled)("WeldPilot agent integration", () => {
  it(
    "runs a real Claude agent turn with manual retrieval",
    async () => {
      const events = [];
      for await (const event of runWeldPilotAgent({
        mode: "manual",
        message: "What is the MIG duty cycle at 200 amps on 240V?",
      })) {
        events.push(event);
      }

      expect(events.some((e) => e.type === "done")).toBe(true);
      expect(events.some((e) => e.type === "evidence")).toBe(true);

      const text = events
        .filter((e) => e.type === "text_delta")
        .map((e) => (e.type === "text_delta" ? e.delta : ""))
        .join("");

      expect(text.length).toBeGreaterThan(20);
    },
    120_000,
  );
});
