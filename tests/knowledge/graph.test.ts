import { describe, it, expect, beforeEach } from "vitest";
import { KnowledgeGraph } from "@/lib/knowledge/graph";
import { buildKnowledgeGraph, resetKnowledgeGraphCache } from "@/lib/knowledge/build";
import type { MachineConfiguration } from "@/lib/knowledge/schemas";

describe("KnowledgeGraph", () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    resetKnowledgeGraphCache();
    graph = buildKnowledgeGraph();
  });

  it("builds nodes from manual data", () => {
    const stats = graph.getStats();
    expect(stats.nodeCount).toBeGreaterThan(50);
    expect(stats.relationshipCount).toBeGreaterThan(20);
    expect(stats.evidenceCount).toBeGreaterThan(10);
  });

  it("includes canonical ports and processes", () => {
    expect(graph.getTypedNode("port-positive", "port")).toBeDefined();
    expect(graph.getTypedNode("process-mig-solid", "welding_process")).toBeDefined();
    expect(graph.getTypedNode("process-flux", "welding_process")).toBeDefined();
  });

  it("has verified polarity for flux and mig-solid", () => {
    const fluxPolarity = graph
      .getNodesByType("polarity_configuration")
      .find((p) => p.processId === "process-flux" && p.verificationStatus === "verified");
    expect(fluxPolarity).toBeDefined();
    expect(fluxPolarity?.polarityType).toBe("DCEN");
    expect(fluxPolarity?.groundPortId).toBe("port-positive");
    expect(fluxPolarity?.electrodePortId).toBe("port-negative");

    const migPolarity = graph
      .getNodesByType("polarity_configuration")
      .find((p) => p.processId === "process-mig-solid" && p.verificationStatus === "verified");
    expect(migPolarity).toBeDefined();
    expect(migPolarity?.polarityType).toBe("DCEP");
  });

  it("has verified MIG duty cycle at 200A 240V", () => {
    const record = graph
      .getNodesByType("duty_cycle_record")
      .find(
        (d) =>
          d.processId === "process-mig" &&
          d.inputVoltage === 240 &&
          d.amps === 200 &&
          d.dutyPercent === 25,
      );
    expect(record).toBeDefined();
    expect(record?.verificationStatus).toBe("verified");
  });

  it("traverses outgoing and incoming relationships", () => {
    const rels = graph.getOutgoing("process-flux", "process_requires_polarity");
    expect(rels.length).toBeGreaterThan(0);
    const polarityId = rels[0]!.toId;
    expect(graph.getTypedNode(polarityId, "polarity_configuration")).toBeDefined();
  });

  it("serializes to snapshot", () => {
    const snapshot = graph.toSnapshot();
    expect(snapshot.version).toBe(1);
    expect(snapshot.nodes.length).toBe(graph.getStats().nodeCount);
    expect(snapshot.relationships.length).toBe(graph.getStats().relationshipCount);
  });
});

describe("MachineConfiguration", () => {
  it("accepts valid configuration shape", () => {
    const config: MachineConfiguration = {
      id: "user-config-1",
      processId: "process-mig-solid",
      inputVoltage: 240,
      consumableIds: ["consumable-solid-wire", "consumable-c25-gas"],
      componentIds: [],
    };
    expect(config.processId).toBe("process-mig-solid");
  });
});
