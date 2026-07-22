import { describe, expect, it } from "vitest";
import { validateArtifactSpec } from "@/lib/artifacts/registry";
import {
  bestFigureForQuery,
  buildManualFigureArtifact,
  buildWeldDefectComparisonFromManual,
  rankRelevantFigures,
  selectVisualArtifactTypes,
  shouldAttachVisual,
} from "@/lib/visual";

describe("shouldAttachVisual", () => {
  it("detects location and explicit visual requests", () => {
    expect(shouldAttachVisual({ query: "Where is the TIG torch negative socket?" })).toBe(true);
    expect(shouldAttachVisual({ query: "Show me the weld diagnosis examples" })).toBe(true);
    expect(shouldAttachVisual({ query: "What is the rated duty cycle at 200A?" })).toBe(false);
  });
});

describe("rankRelevantFigures", () => {
  it("ranks TIG socket location to page 24", () => {
    const ranked = rankRelevantFigures(
      "Where does the TIG torch cable plug in on the OmniPro 220?",
      undefined,
      [{ page: 24 }],
    );
    expect(ranked[0]?.provenance.page).toBe(24);
    expect(ranked[0]?.provenance.source).toBe("owner-manual.pdf");
  });

  it("ranks ground clamp placement to polarity setup page 14", () => {
    const ranked = rankRelevantFigures(
      "Where does the ground clamp cable plug in for MIG solid wire?",
      undefined,
      [{ page: 14 }],
    );
    expect(ranked[0]?.provenance.page).toBe(14);
  });

  it("ranks front panel controls to page 8", () => {
    const ranked = rankRelevantFigures("Label the front panel controls from the manual diagram");
    expect(ranked[0]?.provenance.page).toBe(8);
  });

  it("ranks wire feed mechanism to page 17", () => {
    const ranked = rankRelevantFigures("How does the wire feed mechanism and tensioner work?");
    expect(ranked.some((f) => f.provenance.page === 17)).toBe(true);
  });

  it("ranks porosity diagnosis to page 37", () => {
    const ranked = rankRelevantFigures("Show porosity examples from the weld diagnosis chart", undefined, [
      { page: 37 },
    ]);
    expect(ranked[0]?.provenance.page).toBe(37);
  });

  it("ranks settings selection chart to selection-chart.pdf page 1", () => {
    const ranked = rankRelevantFigures("Where is the settings selection chart?");
    expect(ranked[0]?.provenance.source).toBe("selection-chart.pdf");
    expect(ranked[0]?.provenance.page).toBe(1);
  });
});

describe("buildManualFigureArtifact", () => {
  it("validates schema and includes fallback note for full-page renders", () => {
    const figure = bestFigureForQuery("connect shielding gas bottle regulator", [{ page: 14 }]);
    expect(figure).not.toBeNull();
    const spec = buildManualFigureArtifact(figure!, {
      citations: [{ source: "owner-manual.pdf", page: 14 }],
    });
    expect(validateArtifactSpec(spec)).not.toBeNull();
    expect(spec.caption.length).toBeGreaterThan(0);
    expect(spec.page).toBe(14);
    expect(spec.fallbackNote).toMatch(/full manual page/i);
    expect(spec.imagePath).toMatch(/p14/);
  });
});

describe("selectVisualArtifactTypes", () => {
  it("selects manual-figure and component-map for front panel labeling", () => {
    const types = selectVisualArtifactTypes({
      query: "Label the front panel controls from the manual diagram",
      acceptedPages: [{ page: 8 }],
      requiredTypes: ["component-map", "manual-figure"],
      category: "visual_content",
    });
    expect(types).toContain("manual-figure");
    expect(types).toContain("component-map");
  });

  it("selects weld-defect-comparison for diagnosis chart requests", () => {
    const types = selectVisualArtifactTypes({
      query: "Show me the weld diagnosis examples from the manual",
      acceptedPages: [{ page: 37 }],
      requiredTypes: ["manual-figure", "weld-defect-comparison"],
      category: "visual_content",
    });
    expect(types).toContain("weld-defect-comparison");
    expect(types).toContain("manual-figure");
  });

  it("does not let the generic manual-figure fallback shadow a more specific diagram type", () => {
    // Regression: artifact selection uses "last registered wins" — if
    // manual-figure were unconditionally added alongside polarity-diagram,
    // it would shadow the more specific, deterministic diagram and the
    // model would waste a turn trying to regenerate it itself.
    const types = selectVisualArtifactTypes({
      query:
        "For TIG on this machine, which polarity and which socket should the work clamp go into?",
    });
    expect(types).toContain("polarity-diagram");
    expect(types).not.toContain("manual-figure");
  });

  it("still honors an explicitly required manual-figure alongside a specific diagram type", () => {
    const types = selectVisualArtifactTypes({
      query: "Which polarity should I use for TIG?",
      requiredTypes: ["manual-figure"],
    });
    expect(types).toContain("polarity-diagram");
    expect(types).toContain("manual-figure");
  });
});

describe("buildWeldDefectComparisonFromManual", () => {
  it("produces a valid weld-defect-comparison artifact", () => {
    const spec = buildWeldDefectComparisonFromManual(
      "Show me porosity from the manual weld diagnosis chart",
      37,
    );
    expect(validateArtifactSpec(spec)).not.toBeNull();
    expect(spec.defectName.toLowerCase()).toContain("porosity");
    expect(spec.exemplars.length).toBeGreaterThan(0);
    expect(spec.exemplars[0]?.page).toBe(37);
  });
});
