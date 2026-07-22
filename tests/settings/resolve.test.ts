import { describe, it, expect } from "vitest";
import { parseThickness, matchChartLabel } from "@/lib/settings/thickness";
import { extractSettingsParams } from "@/lib/settings/extract-params";
import { resolveSettings } from "@/lib/settings/resolve";
import { buildSettingsConfiguratorArtifact } from "@/lib/settings/artifact";

describe("parseThickness", () => {
  it("parses 1/8 inch", () => {
    const t = parseThickness("1/8 inch");
    expect(t?.label).toBe('1/8"');
    expect(t?.inches).toBeCloseTo(0.125, 3);
  });

  it("parses 0.125 inch", () => {
    const t = parseThickness("0.125 inch");
    expect(t?.label).toBe('1/8"');
  });

  it("parses eighth-inch phrase", () => {
    const t = parseThickness("eighth-inch");
    expect(t?.label).toBe('1/8"');
  });

  it("parses 3.2 mm as ~1/8 inch", () => {
    const t = parseThickness("3.2 mm");
    expect(t?.label).toBe('1/8"');
    expect(t?.millimeters).toBe(3.2);
  });

  it("parses 3/16", () => {
    const t = parseThickness('3/16"');
    expect(t?.label).toBe('3/16"');
  });
});

describe("matchChartLabel", () => {
  it("maps 0.125 to 1/8", () => {
    expect(matchChartLabel(0.125)).toBe('1/8"');
  });
});

describe("resolveSettings", () => {
  it("resolves 1/8-inch mild steel MIG with fields preserved", () => {
    const resolution = resolveSettings({
      query: "MIG settings for 1/8 inch mild steel on 240V?",
      process: "mig",
      material: "Mild Steel",
      thickness: '1/8"',
      inputVoltage: 240,
    });

    expect(resolution.process).toBe("mig");
    expect(resolution.material).toBe("Mild Steel");
    expect(resolution.thicknessNormalized?.label).toBe('1/8"');
    expect(resolution.inputVoltage).toBe(240);
    expect(resolution.recommendationStatus).toBe("multimodal_required");
    expect(resolution.voltageSetting).toBeUndefined();
    expect(resolution.wireFeedSetting).toBeUndefined();
    expect(resolution.naturalLanguageAnswer).toMatch(/1\/8/i);
    expect(resolution.naturalLanguageAnswer).toMatch(/mild steel/i);
    expect(resolution.naturalLanguageAnswer).toMatch(/240V/i);
    expect(resolution.naturalLanguageAnswer).toMatch(/not inventing|door chart/i);
    expect(resolution.citations.some((c) => c.source === "selection-chart.pdf")).toBe(true);
    expect(resolution.sourceRecords.length).toBeGreaterThan(0);
  });

  it("resolves 3/16-inch flux material", () => {
    const resolution = resolveSettings({
      query: "Flux-core settings for 3/16 mild steel?",
      process: "flux",
      material: "Mild Steel",
      thickness: '3/16"',
    });

    expect(resolution.thicknessNormalized?.label).toBe('3/16"');
    expect(resolution.process).toBe("flux");
    expect(resolution.naturalLanguageAnswer).toMatch(/3\/16/i);
    expect(resolution.recommendationStatus).toBe("multimodal_required");
  });

  it("accepts equivalent metric thickness for chart row", () => {
    const resolution = resolveSettings({
      query: "MIG mild steel 3.2 mm settings",
      process: "mig",
      material: "Mild Steel",
      thickness: "3.2 mm",
    });

    expect(resolution.thicknessNormalized?.label).toBe('1/8"');
    expect(resolution.recommendationStatus).toBe("multimodal_required");
    expect(resolution.sourceRecords.some((r) => r.id.includes("1-8"))).toBe(true);
  });

  it("returns unsupported for thickness beyond documented chart", () => {
    const resolution = resolveSettings({
      query: "MIG settings for 2 inch mild steel",
      process: "mig",
      material: "Mild Steel",
      thickness: "2 inch",
    });

    expect(resolution.recommendationStatus).toBe("unsupported");
    expect(resolution.voltageSetting).toBeUndefined();
    expect(resolution.naturalLanguageAnswer).toMatch(/not find|unsupported|Do not guess/i);
  });

  it("flags missing wire type when process unknown (partial)", () => {
    const resolution = resolveSettings({
      query: "What settings should I use?",
    });

    expect(resolution.recommendationStatus).toBe("partial");
    expect(resolution.missingRequiredParameters).toContain("process");
    expect(resolution.clarifyingQuestion).toBeTruthy();
  });

  it("detects conflicting process and consumable", () => {
    const resolution = resolveSettings({
      query: "MIG settings",
      process: "mig",
      material: "Mild Steel",
      thickness: '1/8"',
      wireType: "flux-cored wire",
    });

    expect(resolution.recommendationStatus).toBe("conflicting");
    expect(resolution.conflicts.length).toBeGreaterThan(0);
    expect(resolution.naturalLanguageAnswer).toMatch(/incompatible|conflict/i);
  });

  it("notes ambiguous input voltage when not specified", () => {
    const resolution = resolveSettings({
      process: "mig",
      material: "Mild Steel",
      thickness: '1/8"',
    });

    expect(resolution.recommendationStatus).toBe("multimodal_required");
    expect(resolution.missingRequiredParameters).toContain("input voltage (120V or 240V)");
    expect(resolution.clarifyingQuestion).toMatch(/120V or 240V/i);
  });

  it("builds artifact with all supported fields preserved", () => {
    const resolution = resolveSettings({
      process: "mig",
      material: "Mild Steel",
      thickness: '1/8"',
      inputVoltage: 240,
      wireType: "solid core",
      wireDiameter: "0.030",
      shieldingGas: "C25",
    });

    const artifact = buildSettingsConfiguratorArtifact(resolution);
    expect(artifact?.type).toBe("settings-configurator");
    if (artifact?.type !== "settings-configurator") return;

    expect(artifact.material).toBe("Mild Steel");
    expect(artifact.thickness).toBe('1/8"');
    expect(artifact.inputVoltage).toBe(240);
    expect(artifact.wireType).toBe("solid core");
    expect(artifact.wireDiameter).toBe("0.030");
    expect(artifact.recommended?.polarity).toBe("DCEP");
    expect(artifact.recommended?.recommendationStatus).toBe("multimodal_required");
    expect(artifact.recommended?.thicknessOriginal).toBeTruthy();
    expect(artifact.citations.length).toBeGreaterThan(0);
  });

  it("chart location query cites door and selection chart", () => {
    const resolution = resolveSettings({
      query: "Where do I find recommended wire speed and voltage values?",
    });

    expect(resolution.naturalLanguageAnswer).toMatch(/door/i);
    expect(resolution.naturalLanguageAnswer).toMatch(/Settings Chart/i);
    expect(resolution.citations.some((c) => c.source === "selection-chart.pdf")).toBe(true);
  });
});

describe("extractSettingsParams", () => {
  it("merges query and structured input without dropping thickness", () => {
    const params = extractSettingsParams({
      query: "MIG settings for 1/8 inch mild steel on 240V",
      process: "mig",
      material: "Mild Steel",
    });

    expect(params.process).toBe("mig");
    expect(params.material).toBe("Mild Steel");
    expect(params.thicknessNormalized?.label).toBe('1/8"');
    expect(params.inputVoltage).toBe(240);
  });
});
