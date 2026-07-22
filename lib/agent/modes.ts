import type { WeldMode } from "@/lib/schemas/conversation";
import type { MachineState } from "@/lib/schemas/conversation";
import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";

export function createInitialMachineState(mode: WeldMode): MachineState {
  return {
    mode,
    symptoms: [],
    hypotheses: [],
    askedQuestions: [],
    safetyAcknowledged: false,
  };
}

export function getModeWelcomeMessage(mode: WeldMode): string {
  const messages: Record<WeldMode, string> = {
    setup:
      "I'm ready to help you set up your Vulcan OmniPro 220. Tell me which process you're configuring — MIG, flux-cored, TIG, or stick — and I'll walk you through polarity, wire feed, and gas setup with visual guides.",
    diagnose:
      "Describe what's wrong with your weld — porosity, spatter, burn-through, poor penetration — or upload a photo. I'll rank likely causes from the manual and ask the most useful clarifying question.",
    settings:
      "Tell me your welding process, material, and thickness. I'll recommend voltage, wire speed, and gas settings from the selection chart and manual specifications.",
    manual:
      "Ask any technical question about the OmniPro 220. I'll answer from the owner's manual with page citations and relevant diagrams.",
  };
  return messages[mode];
}

export function getPlaceholderArtifactForMode(mode: WeldMode): ArtifactSpec {
  switch (mode) {
    case "setup":
      return {
        type: "polarity-diagram",
        title: "MIG Solid Core — DCEP Polarity",
        process: "mig-solid",
        polarityType: "DCEP",
        groundSocket: "negative",
        electrodeSocket: "positive",
        groundLabel: "Ground Clamp",
        electrodeLabel: "MIG Gun",
        citations: [{ source: "owner-manual.pdf", page: 14, section: "DCEP Setup" }],
        confidence: "high",
      };
    case "diagnose":
      return {
        type: "diagnostic-hypothesis-board",
        title: "Diagnostic Hypotheses",
        hypotheses: [
          { id: "h1", label: "Incorrect polarity for process", confidence: 0.35, evidenceFor: ["owner-manual.pdf p.43"], evidenceAgainst: [] },
          { id: "h2", label: "Insufficient shielding gas (MIG)", confidence: 0.25, evidenceFor: ["owner-manual.pdf p.43"], evidenceAgainst: [] },
          { id: "h3", label: "Dirty workpiece or wire", confidence: 0.2, evidenceFor: ["owner-manual.pdf p.43"], evidenceAgainst: [] },
        ],
        citations: [{ source: "owner-manual.pdf", page: 43 }],
        confidence: "medium",
      };
    case "settings":
      return {
        type: "settings-configurator",
        title: "Settings Configurator",
        process: "mig",
        material: "Mild Steel",
        thickness: '1/8"',
        setupChecklist: [],
        supportingEvidence: [],
        citations: [{ source: "selection-chart.pdf", page: 1 }],
        confidence: "low",
      };
    case "manual":
      return {
        type: "manual-figure",
        title: "Specifications",
        caption: "Specifications table — duty cycles and current ranges",
        assetId: "owner-manual-p07",
        source: "owner-manual.pdf",
        page: 7,
        citations: [{ source: "owner-manual.pdf", page: 7 }],
        confidence: "high",
      };
  }
}
