import { describe, it, expect } from "vitest";
import { ArtifactSpecSchema } from "@/lib/schemas/artifacts/types";
import { ARTIFACT_GALLERY_SAMPLES } from "@/lib/artifacts/samples";
import { validateArtifactSpec, normalizeArtifactSpec } from "@/lib/artifacts/registry";

describe("artifact schemas", () => {
  it("validates all gallery samples", () => {
    for (const sample of ARTIFACT_GALLERY_SAMPLES) {
      const result = ArtifactSpecSchema.safeParse(sample);
      expect(result.success, `failed: ${sample.type}`).toBe(true);
    }
  });

  it("normalizes legacy polarity_diagram type", () => {
    const legacy = {
      type: "polarity_diagram",
      title: "Legacy polarity",
      process: "mig-solid",
      groundSocket: "negative",
      electrodeSocket: "positive",
    };
    const normalized = normalizeArtifactSpec(legacy);
    expect(normalized?.type).toBe("polarity-diagram");
    expect(normalized?.title).toBe("Legacy polarity");
  });

  it("normalizes legacy hypothesis_panel to diagnostic-hypothesis-board", () => {
    const legacy = {
      type: "hypothesis_panel",
      hypotheses: [
        { id: "h1", label: "Gas issue", posterior: 0.4, evidence: ["p.43"] },
      ],
    };
    const normalized = normalizeArtifactSpec(legacy);
    expect(normalized?.type).toBe("diagnostic-hypothesis-board");
    if (normalized?.type === "diagnostic-hypothesis-board") {
      expect(normalized.hypotheses[0]?.confidence).toBe(0.4);
    }
  });

  it("rejects arbitrary HTML artifact types", () => {
    const malicious = {
      type: "html_snippet",
      html: "<script>alert(1)</script>",
    };
    expect(validateArtifactSpec(malicious)).toBeNull();
  });

  it("rejects unknown fields without valid type", () => {
    expect(validateArtifactSpec({ foo: "bar" })).toBeNull();
  });
});
