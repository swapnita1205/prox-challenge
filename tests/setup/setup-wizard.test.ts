import { describe, expect, it } from "vitest";
import { buildSetupPack } from "@/lib/setup/build-pack";
import { validateSetupInputs } from "@/lib/setup/validate";
import { canGeneratePack, isStepComplete } from "@/lib/setup/steps";

describe("setup validation", () => {
  it("flags MIG solid without shielding gas", () => {
    const result = validateSetupInputs({
      process: "mig-solid",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "ER70S-6 solid wire",
      wireDiameter: '0.030"',
      shielding: "none",
    });
    expect(result.issues.some((i) => i.code === "shielding_mismatch")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("flags flux wire on MIG solid process", () => {
    const result = validateSetupInputs({
      process: "mig-solid",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "E71T-11 flux wire",
      wireDiameter: '0.030"',
      shielding: "c25",
    });
    expect(result.issues.some((i) => i.code === "process_wire_mismatch")).toBe(true);
  });

  it("flags gasless flux with C25 shielding", () => {
    const result = validateSetupInputs({
      process: "flux",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "E71T-11 flux wire",
      wireDiameter: '0.030"',
      gasShieldedFlux: false,
      shielding: "c25",
    });
    expect(result.issues.some((i) => i.code === "shielding_mismatch")).toBe(true);
  });

  it("passes valid MIG solid setup", () => {
    const result = validateSetupInputs({
      process: "mig-solid",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "ER70S-6 solid wire",
      wireDiameter: '0.030"',
      shielding: "c25",
    });
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(result.status).toBe("verified");
  });
});

describe("setup pack generation", () => {
  it("generates full setup pack for flux", () => {
    const pack = buildSetupPack({
      process: "flux",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "E71T-GS self-shielded flux wire",
      wireDiameter: '0.030"',
      gasShieldedFlux: false,
      shielding: "none",
    });

    expect(pack.artifacts.length).toBe(6);
    expect(pack.artifacts.map((a) => a.type)).toContain("polarity-diagram");
    expect(pack.artifacts.map((a) => a.type)).toContain("cable-routing-diagram");
    expect(pack.artifacts.map((a) => a.type)).toContain("step-by-step-checklist");
    expect(pack.artifacts.map((a) => a.type)).toContain("configuration-summary");
    expect(pack.artifacts.map((a) => a.type)).toContain("manual-figure");

    const polarity = pack.artifacts.find((a) => a.type === "polarity-diagram");
    expect(polarity?.type === "polarity-diagram" && polarity.polarityType).toBe("DCEN");

    const settings = pack.artifacts.find((a) => a.type === "settings-configurator");
    expect(settings?.type === "settings-configurator" && settings.recommended?.notes).toMatch(
      /door chart|selection-chart/i,
    );
  });

  it("includes TIG cable routing from manual p.24", () => {
    const pack = buildSetupPack({
      process: "tig",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "ER70S-2 filler",
      shielding: "100-argon",
    });

    const cables = pack.artifacts.find((a) => a.type === "cable-routing-diagram");
    expect(cables?.type === "cable-routing-diagram" && cables.routes.length).toBeGreaterThan(0);
    expect(pack.citations.some((c) => c.page === 24)).toBe(true);
  });

  it("does not invent numeric settings", () => {
    const pack = buildSetupPack({
      process: "mig-solid",
      inputVoltage: 240,
      material: "Mild Steel",
      thickness: '1/8"',
      consumable: "ER70S-6",
      wireDiameter: '0.030"',
      shielding: "c25",
    });
    const settings = pack.artifacts.find((a) => a.type === "settings-configurator");
    if (settings?.type === "settings-configurator") {
      expect(settings.recommended?.voltage).toBeUndefined();
      expect(settings.recommended?.wireSpeed).toBeUndefined();
    }
  });

  it("builds ask prompt with user inputs", () => {
    const pack = buildSetupPack({
      process: "stick",
      inputVoltage: 120,
      material: "Mild Steel",
      thickness: '3/16"',
      consumable: "E7018",
    });
    expect(pack.askPrompt).toMatch(/stick/i);
    expect(pack.askPrompt).toMatch(/120/);
  });
});

describe("wizard steps", () => {
  it("requires wire step for flux", () => {
    const inputs = { process: "flux" as const };
    expect(isStepComplete("wire", { ...inputs, wireDiameter: '0.030"' })).toBe(true);
    expect(canGeneratePack({ ...inputs, inputVoltage: 240, material: "Steel", thickness: '1/8"', consumable: "flux", wireDiameter: '0.030"', gasShieldedFlux: false, shielding: "none" })).toBe(true);
  });
});
