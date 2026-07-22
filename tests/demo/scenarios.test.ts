import { describe, it, expect } from "vitest";
import { DEMO_SCENARIOS, TOTAL_DEMO_MINUTES, getDemoScenario } from "@/lib/demo/scenarios";

describe("demo scenarios", () => {
  it("defines exactly five judge scenarios", () => {
    expect(DEMO_SCENARIOS).toHaveLength(5);
    expect(DEMO_SCENARIOS.map((s) => s.id)).toEqual([
      "duty-cycle",
      "tig-setup",
      "flux-porosity",
      "settings-configurator",
      "visual-diagnosis",
    ]);
  });

  it("fits under five minutes total", () => {
    expect(TOTAL_DEMO_MINUTES).toBeLessThanOrEqual(5);
  });

  it("includes challenge prompt for duty cycle", () => {
    const s = getDemoScenario("duty-cycle");
    expect(s?.prompt).toMatch(/200A.*240V/i);
    expect(s?.mode).toBe("manual");
    expect(s?.action).toBe("chat");
  });

  it("includes TIG polarity prompt with setup pack", () => {
    const s = getDemoScenario("tig-setup");
    expect(s?.prompt).toMatch(/polarity|TIG/i);
    expect(s?.setupInputs?.process).toBe("tig");
    expect(s?.action).toBe("setup-pack-then-chat");
  });

  it("includes flux porosity detective prompt", () => {
    const s = getDemoScenario("flux-porosity");
    expect(s?.prompt).toMatch(/porosity.*flux/i);
    expect(s?.mode).toBe("diagnose");
  });

  it("settings configurator has MIG prefilled inputs", () => {
    const s = getDemoScenario("settings-configurator");
    expect(s?.setupInputs?.process).toBe("mig-solid");
    expect(s?.action).toBe("settings-pack");
  });

  it("visual diagnosis bundles sample image path", () => {
    const s = getDemoScenario("visual-diagnosis");
    expect(s?.sampleImagePath).toBe("/demo/sample-weld-porosity.svg");
    expect(s?.action).toBe("visual-analysis");
  });
});
