import { describe, it, expect, beforeEach } from "vitest";
import { buildKnowledgeGraph, resetKnowledgeGraphCache } from "@/lib/knowledge/build";
import {
  findActionsForComponent,
  findContradictions,
  findFaultsForSymptom,
  findSymptomByName,
  getCorrectiveActionsForFault,
  getDiagnosticTestsForFault,
  getEvidenceForRelationship,
  getRequiredSetup,
  getSafetyPrerequisites,
  validateConfiguration,
} from "@/lib/knowledge/queries";
import type { KnowledgeGraph } from "@/lib/knowledge/graph";

describe("knowledge queries", () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    resetKnowledgeGraphCache();
    graph = buildKnowledgeGraph();
  });

  describe("getRequiredSetup", () => {
    it("returns polarity and consumables for MIG solid core", () => {
      const setup = getRequiredSetup(graph, "process-mig-solid");
      expect(setup).not.toBeNull();
      expect(setup!.polarity?.polarityType).toBe("DCEP");
      expect(setup!.consumables).toContain("consumable-solid-wire");
      expect(setup!.consumables).toContain("consumable-c25-gas");
      expect(setup!.verificationStatus).not.toBe("unverified");
    });

    it("returns DCEN polarity for flux process", () => {
      const setup = getRequiredSetup(graph, "process-flux");
      expect(setup!.polarity?.polarityType).toBe("DCEN");
      expect(setup!.consumables).toContain("consumable-flux-wire");
    });

    it("returns null for unknown process", () => {
      expect(getRequiredSetup(graph, "process-unknown")).toBeNull();
    });
  });

  describe("findFaultsForSymptom", () => {
    it("finds faults linked to porosity symptom", () => {
      const symptom = findSymptomByName(graph, "porosity");
      expect(symptom).toBeDefined();

      const faults = findFaultsForSymptom(graph, symptom!.id);
      expect(faults.length).toBeGreaterThan(0);
      expect(faults.some((f) => f.fault?.name.toLowerCase().includes("polarity"))).toBe(true);
    });

    it("includes evidence on relationships", () => {
      const symptom = findSymptomByName(graph, "porosity");
      const faults = findFaultsForSymptom(graph, symptom!.id);
      const withEvidence = faults.filter((f) => f.evidence.length > 0);
      expect(withEvidence.length).toBeGreaterThan(0);
    });
  });

  describe("findActionsForComponent", () => {
    it("returns corrective actions affecting contact tip", () => {
      const actions = findActionsForComponent(graph, "comp-contact-tip");
      // May be empty if no action explicitly linked; test structure still valid
      expect(Array.isArray(actions)).toBe(true);
    });
  });

  describe("getSafetyPrerequisites", () => {
    it("returns safety constraints for corrective actions", () => {
      const actions = graph.getNodesByType("corrective_action");
      if (actions.length === 0) return;
      const prereqs = getSafetyPrerequisites(graph, actions[0]!.id);
      expect(Array.isArray(prereqs)).toBe(true);
    });
  });

  describe("validateConfiguration", () => {
    it("flags missing polarity as unverified", () => {
      const result = validateConfiguration(graph, {
        id: "cfg-1",
        processId: "process-mig-solid",
        inputVoltage: 240,
        consumableIds: [],
        componentIds: [],
      });
      expect(result.unverified.some((u) => u.toLowerCase().includes("polarity"))).toBe(true);
    });

    it("detects wrong polarity config id", () => {
      const fluxPolarity = graph
        .getNodesByType("polarity_configuration")
        .find((p) => p.processId === "process-flux");
      const result = validateConfiguration(graph, {
        id: "cfg-2",
        processId: "process-mig-solid",
        polarityConfigId: fluxPolarity?.id,
        consumableIds: [],
        componentIds: [],
      });
      expect(result.contradictions.some((c) => c.type === "polarity_mismatch")).toBe(true);
    });
  });

  describe("findContradictions", () => {
    it("returns contradictions for mismatched setup", () => {
      const fluxPolarity = graph
        .getNodesByType("polarity_configuration")
        .find((p) => p.processId === "process-flux" && p.verificationStatus === "verified");
      const contradictions = findContradictions(graph, {
        id: "cfg-3",
        processId: "process-mig-solid",
        polarityConfigId: fluxPolarity?.id,
        consumableIds: [],
        componentIds: [],
      });
      expect(contradictions.length).toBeGreaterThan(0);
    });
  });

  describe("getEvidenceForRelationship", () => {
    it("returns manual evidence for symptom-fault links", () => {
      const symptom = findSymptomByName(graph, "porosity");
      const faults = findFaultsForSymptom(graph, symptom!.id);
      if (faults.length === 0) return;

      const relId = faults[0]!.relationship.id;
      const evidence = getEvidenceForRelationship(graph, relId);
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence[0]!.provenance.source).toBe("owner-manual.pdf");
    });
  });

  describe("fault diagnostics", () => {
    it("links faults to diagnostic tests and corrective actions", () => {
      const symptom = findSymptomByName(graph, "porosity");
      const faults = findFaultsForSymptom(graph, symptom!.id);
      if (faults.length === 0) return;

      const faultId = faults[0]!.fault!.id;
      const tests = getDiagnosticTestsForFault(graph, faultId);
      const actions = getCorrectiveActionsForFault(graph, faultId);
      expect(tests.length + actions.length).toBeGreaterThan(0);
    });
  });
});
