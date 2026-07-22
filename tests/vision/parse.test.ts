import { describe, expect, it } from "vitest";
import {
  buildMockAnalysis,
  extractJsonFromModelText,
  parseWeldPhotoAnalysis,
  sanitizeAnalysisText,
} from "@/lib/vision/parse";

const VALID_ANALYSIS = {
  possibleDefectCategories: ["porosity"],
  visualObservations: [
    "Small round cavities visible along the weld bead surface.",
    "Cannot assess shielding gas or polarity from this angle.",
  ],
  confidence: "medium",
  uncertaintyNotes: ["Photo lighting is uneven."],
  potentialCauses: [
    {
      cause: "Dirty workpiece or welding wire per manual",
      groundedInManual: true,
      citation: {
        source: "owner-manual.pdf",
        page: 37,
        section: "Wire Weld – Porosity",
        excerpt: "Small cavities or holes in the bead.",
      },
    },
  ],
  recommendedNextStep: "Verify polarity and gas flow before adjusting wire speed.",
  matchedManualFigure: {
    assetId: "owner-manual-p37-page",
    source: "owner-manual.pdf",
    page: 37,
    label: "Wire Weld – Porosity",
    section: "Wire Weld – Porosity",
    matchScore: 0.72,
  },
  alternateFigures: [],
  regions: [
    { id: "r1", label: "Bead surface", x: 20, y: 30, width: 60, height: 40 },
  ],
  callouts: [{ id: "c1", label: "Cavity cluster", x: 45, y: 50 }],
  disclaimer: "Visual diagnosis from a photo alone may be insufficient.",
  repairConfirmed: false,
};

describe("vision parse", () => {
  it("parses fenced JSON from model text", () => {
    const raw = extractJsonFromModelText(
      "Here is the analysis:\n```json\n" + JSON.stringify(VALID_ANALYSIS) + "\n```",
    );
    const parsed = parseWeldPhotoAnalysis(raw, "flux");
    expect(parsed.possibleDefectCategories).toContain("porosity");
    expect(parsed.repairConfirmed).toBe(false);
  });

  it("rejects repairConfirmed true", () => {
    expect(() =>
      parseWeldPhotoAnalysis({ ...VALID_ANALYSIS, repairConfirmed: true }, "flux"),
    ).toThrow(/repair|expected false/i);
  });

  it("sanitizes forbidden repair-confirmed phrasing", () => {
    const out = sanitizeAnalysisText("Repair confirmed for porosity issue");
    expect(out.toLowerCase()).not.toContain("repair confirmed");
  });

  it("filters invalid bounding boxes", () => {
    const raw = {
      ...VALID_ANALYSIS,
      regions: [
        { id: "bad", label: "x", x: 90, y: 90, width: 20, height: 20 },
        { id: "good", label: "y", x: 10, y: 10, width: 30, height: 30 },
      ],
    };
    const parsed = parseWeldPhotoAnalysis(raw);
    expect(parsed.regions).toHaveLength(1);
    expect(parsed.regions[0]?.id).toBe("good");
  });

  it("buildMockAnalysis returns low-confidence placeholder", () => {
    const mock = buildMockAnalysis("porosity in flux weld", "flux");
    expect(mock.confidence).toBe("low");
    expect(mock.repairConfirmed).toBe(false);
    expect(mock.matchedManualFigure.page).toBe(37);
  });
});

describe("vision analyze response contract", () => {
  it("mock analysis builds valid artifact input shape", () => {
    const analysis = buildMockAnalysis("porosity", "flux");
    expect(analysis.potentialCauses.every((c) => c.groundedInManual)).toBe(true);
    expect(analysis.disclaimer.length).toBeGreaterThan(20);
    expect(analysis.visualObservations.length).toBeGreaterThan(0);
  });
});
