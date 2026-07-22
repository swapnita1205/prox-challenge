import { describe, it, expect } from "vitest";
import {
  normalizeArtifactSpec,
  provenanceFromAssetId,
} from "@/lib/artifacts/normalize";
import { createAgentContext } from "@/lib/agent/context";
import { parseAgentResponse } from "@/lib/agent/parse";

describe("normalizeArtifactSpec", () => {
  it("maps kind:manual_image to manual-figure with caption/source/page from assetId", () => {
    const spec = normalizeArtifactSpec({
      kind: "manual_image",
      title: "Front panel",
      assetId: "manual-assets/owner-manual/p08.png",
    });
    expect(spec).not.toBeNull();
    expect(spec?.type).toBe("manual-figure");
    if (spec?.type === "manual-figure") {
      expect(spec.caption).toBeTruthy();
      expect(spec.source).toBe("owner-manual.pdf");
      expect(spec.page).toBe(8);
      expect(spec.assetId).toContain("p08");
    }
  });

  it("promotes callouts to annotated-manual-figure", () => {
    const spec = normalizeArtifactSpec({
      kind: "manual_image",
      title: "Front panel controls",
      assetId: "manual-assets/owner-manual/p08.png",
      callouts: [{ id: "c1", label: "Voltage", x: 20, y: 30 }],
    });
    expect(spec?.type).toBe("annotated-manual-figure");
  });

  it("maps polarity connections[] to groundSocket/electrodeSocket", () => {
    const spec = normalizeArtifactSpec({
      kind: "polarity_diagram",
      title: "TIG polarity",
      process: "tig",
      connections: [
        { cable: "ground clamp", socket: "positive" },
        { cable: "torch", socket: "negative" },
      ],
    });
    expect(spec?.type).toBe("polarity-diagram");
    if (spec?.type === "polarity-diagram") {
      expect(spec.groundSocket).toBe("positive");
      expect(spec.electrodeSocket).toBe("negative");
    }
  });
});

describe("provenanceFromAssetId", () => {
  it("parses owner-manual page assets", () => {
    expect(provenanceFromAssetId("manual-assets/owner-manual/p08.png")).toEqual({
      source: "owner-manual.pdf",
      page: 8,
    });
  });
});

describe("parseAgentResponse front-panel recovery", () => {
  it("keeps a valid answer when artifact uses legacy kind:manual_image", () => {
    const ctx = createAgentContext();
    const raw = JSON.stringify({
      intent: "part_identification",
      answer:
        "The front panel has the process selector, voltage knob, and wire-speed knob (owner-manual.pdf p.8).",
      clarifyingQuestion: null,
      artifact: {
        kind: "manual_image",
        title: "Front panel",
        assetId: "manual-assets/owner-manual/p08.png",
        callouts: [{ id: "c1", label: "Process", x: 10, y: 20 }],
      },
      citations: [{ source: "owner-manual.pdf", page: 8, section: "Controls" }],
      safetyNotices: [],
      confidence: "high",
      suggestedActions: [],
      diagnosticState: null,
    });

    const result = parseAgentResponse(raw, ctx, "part_identification");
    expect(result.recovered).toBe(false);
    expect(result.response.answer).toContain("front panel");
    expect(result.response.artifact?.type).toMatch(/manual-figure|annotated-manual-figure/);
  });
});
