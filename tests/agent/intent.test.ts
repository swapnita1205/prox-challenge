import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/agent/intent";

describe("classifyIntent", () => {
  it("routes setup questions", () => {
    expect(
      classifyIntent("How do I connect the ground clamp for MIG?", "setup"),
    ).toBe("setup");
  });

  it("routes troubleshooting in diagnose mode", () => {
    expect(
      classifyIntent("I'm getting porosity in my welds", "diagnose"),
    ).toBe("troubleshooting");
  });

  it("routes duty cycle to calculation", () => {
    expect(
      classifyIntent("What is the duty cycle at 200 amps on 240V?", "manual"),
    ).toBe("calculation");
  });

  it("routes safety-critical language first", () => {
    expect(
      classifyIntent("Is it safe to weld without a face shield?", "manual"),
    ).toBe("safety_critical");
  });

  it("routes part identification", () => {
    expect(
      classifyIntent("What does the wire feed tensioner do?", "manual"),
    ).toBe("part_identification");
  });
});
