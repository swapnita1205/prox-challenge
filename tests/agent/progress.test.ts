import { describe, it, expect } from "vitest";
import {
  PROGRESS_BY_TOOL,
  artifactLoadingHeading,
  artifactProgressStep,
} from "@/lib/agent/progress";
import { ARTIFACT_TYPE_LABELS } from "@/lib/artifacts/registry";

describe("progress labels", () => {
  it("maps every known tool to a progress step with a non-empty message", () => {
    for (const tool of Object.keys(PROGRESS_BY_TOOL)) {
      const step = PROGRESS_BY_TOOL[tool]!;
      expect(step.message.length).toBeGreaterThan(0);
      expect(["search", "found", "reasoning", "artifact"]).toContain(step.icon);
    }
  });

  it("never leaks internal state labels in tool progress text", () => {
    for (const step of Object.values(PROGRESS_BY_TOOL)) {
      expect(step.message).not.toMatch(/clarification required/i);
      expect(step.message).not.toMatch(/grounding/i);
      expect(step.message).not.toMatch(/internal/i);
    }
  });

  it("builds an artifact-icon progress step carrying the artifact type", () => {
    const step = artifactProgressStep({ type: "duty-cycle-calculator" });
    expect(step.icon).toBe("artifact");
    expect(step.artifactType).toBe("duty-cycle-calculator");
    expect(step.message).toMatch(/calculator/i);
  });

  it("falls back to a generic label for an unrecognized artifact type", () => {
    const step = artifactProgressStep({ type: "not-a-real-type" as never });
    expect(step.message).toBe("Preparing interactive artifact");
  });

  it("produces a distinct loading heading for every known artifact type", () => {
    for (const type of Object.keys(ARTIFACT_TYPE_LABELS)) {
      if (type === "placeholder") continue;
      const heading = artifactLoadingHeading(type);
      expect(heading.length).toBeGreaterThan(0);
      expect(heading).not.toBe("BUILDING ARTIFACT...");
    }
  });

  it("falls back to a generic heading when the artifact type is unknown", () => {
    expect(artifactLoadingHeading(undefined)).toBe("Preparing interactive artifact…");
    expect(artifactLoadingHeading(null)).toBe("Preparing interactive artifact…");
  });
});
