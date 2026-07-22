import { describe, expect, it } from "vitest";
import { extractProcedureFromArtifacts } from "@/lib/garage/procedures";
import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";

const checklistSpec: ArtifactSpec = {
  type: "step-by-step-checklist",
  title: "Wire-Feed Setup",
  steps: [
    { id: "s1", label: "Power OFF — unplug welder", safetyCritical: true, completed: false },
    { id: "s2", label: "Install wire spool", detail: "owner-manual.pdf p.10", completed: false },
  ],
  citations: [{ source: "owner-manual.pdf", page: 10 }],
  confidence: "high",
};

const polaritySpec: ArtifactSpec = {
  type: "polarity-diagram",
  title: "Flux DCEN",
  process: "flux",
  polarityType: "DCEN",
  groundSocket: "positive",
  electrodeSocket: "negative",
  groundLabel: "Ground Clamp",
  electrodeLabel: "Wire Feed",
  citations: [{ source: "owner-manual.pdf", page: 13 }],
  confidence: "high",
};

describe("garage procedure extraction", () => {
  it("prefers step-by-step checklist over polarity", () => {
    const proc = extractProcedureFromArtifacts({
      a: { spec: polaritySpec },
      b: { spec: checklistSpec },
    });
    expect(proc?.title).toBe("Wire-Feed Setup");
    expect(proc?.steps).toHaveLength(2);
    expect(proc?.steps[0]?.shortLabel).toMatch(/Power OFF/i);
  });

  it("falls back to polarity diagram when no checklist", () => {
    const proc = extractProcedureFromArtifacts({
      p: { spec: polaritySpec },
    });
    expect(proc?.steps.length).toBeGreaterThanOrEqual(3);
    expect(proc?.citations[0]?.page).toBe(13);
  });

  it("returns null when no procedural artifacts", () => {
    const proc = extractProcedureFromArtifacts({
      x: {
        spec: {
          type: "manual-figure",
          title: "Figure",
          caption: "x",
          assetId: "a",
          source: "owner-manual.pdf",
          page: 7,
          citations: [],
        },
      },
    });
    expect(proc).toBeNull();
  });

  it("speak text includes detail when present", () => {
    const proc = extractProcedureFromArtifacts({ c: { spec: checklistSpec } });
    const step2 = proc?.steps.find((s) => s.id === "s2");
    expect(step2?.speakText).toMatch(/owner-manual/i);
  });
});
