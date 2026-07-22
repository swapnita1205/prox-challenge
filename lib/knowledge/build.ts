import type { Provenance } from "@/lib/knowledge/schemas";
import { KnowledgeGraph } from "@/lib/knowledge/graph";
import {
  CANONICAL_CABLES,
  CANONICAL_COMPONENTS,
  CANONICAL_CONSUMABLES,
  CANONICAL_MATERIALS,
  CANONICAL_PORTS,
  CANONICAL_PROCESSES,
  COMPONENT_PORT_WIRING,
  INGEST_PROCESS_MAP,
  PROCESS_CONSUMABLES,
} from "@/lib/knowledge/canonical";
import { provenanceToEvidence, toVerificationStatus } from "@/lib/knowledge/graph";
import type {
  CorrectiveAction,
  DiagnosticTest,
  DutyCycleRecord,
  Fault,
  KnowledgeRelationship,
  PolarityConfiguration,
  SafetyConstraint,
  Symptom,
} from "@/lib/knowledge/schemas";

import dutyCycleRaw from "@/data/generated/duty-cycle.json";
import polarityRaw from "@/data/generated/polarity.json";
import { getNormalizedTroubleshootingRecords } from "@/lib/troubleshooting";
import warningsRaw from "@/data/generated/warnings.json";
import settingsRaw from "@/data/generated/settings.json";

interface IngestProvenance {
  source: string;
  page: number;
  section?: string;
  extractionMethod: string;
  confidence: number;
  neighboringText?: string;
  assetPath?: string;
}

interface IngestDutyCycle {
  id: string;
  process: string | null;
  inputVoltage: number | null;
  dutyPercent: number;
  amps: number;
  continuous?: boolean;
  needsReview?: boolean;
  provenance: IngestProvenance;
}

interface IngestPolarity {
  id: string;
  polarityType: string | null;
  process: string | null;
  groundSocket: string | null;
  electrodeSocket: string | null;
  instructions?: string;
  needsReview?: boolean;
  provenance: IngestProvenance;
}

interface IngestTroubleshooting {
  id: string;
  problem: string;
  possibleCauses: string;
  likelySolutions: string;
  processes: string[];
  needsReview?: boolean;
  provenance: IngestProvenance;
}

interface IngestWarning {
  id: string;
  level: string;
  text: string;
  provenance: IngestProvenance;
}

function relId(type: string, from: string, to: string): string {
  return `rel-${type}-${from}-${to}`.replace(/[^a-z0-9-]/gi, "-").slice(0, 120);
}

function addRel(
  graph: KnowledgeGraph,
  params: Omit<KnowledgeRelationship, "id"> & { id?: string },
): KnowledgeRelationship {
  const rel: KnowledgeRelationship = {
    id: params.id ?? relId(params.type, params.fromId, params.toId),
    type: params.type,
    fromId: params.fromId,
    toId: params.toId,
    verificationStatus: params.verificationStatus,
    confidence: params.confidence,
    evidenceIds: params.evidenceIds,
    metadata: params.metadata,
  };
  graph.addRelationship(rel);
  return rel;
}

function socketToPortId(socket: string | null): string | undefined {
  if (!socket) return undefined;
  if (socket === "positive") return "port-positive";
  if (socket === "negative") return "port-negative";
  if (socket === "workpiece") return "port-ground-workpiece";
  return undefined;
}

function parseNumberedList(text: string): string[] {
  return text
    .split(/\d+\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function symptomSlug(name: string): string {
  return `symptom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
}

function faultSlug(name: string): string {
  return `fault-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
}

function buildCanonicalTopology(graph: KnowledgeGraph): void {
  const evidenceId = "evidence-owner-manual-p08-panel";
  const prov: Provenance = {
    source: "owner-manual.pdf",
    page: 8,
    section: "Front Panel Controls",
    extractionMethod: "canonical_from_manual",
    confidence: 0.95,
    neighboringText: "Positive Socket, Negative Socket, MIG Gun Cable Socket, LCD Display",
  };
  graph.addEvidence(provenanceToEvidence(evidenceId, prov));

  for (const port of CANONICAL_PORTS) {
    graph.addNode("port", {
      ...port,
      evidenceIds: [evidenceId],
      verificationStatus: "verified",
    });
  }

  for (const cable of CANONICAL_CABLES) {
    graph.addNode("cable", {
      ...cable,
      evidenceIds: [evidenceId],
      verificationStatus: "verified",
    });
  }

  for (const comp of CANONICAL_COMPONENTS) {
    graph.addNode("machine_component", {
      ...comp,
      evidenceIds: [evidenceId],
      verificationStatus: "verified",
    });
  }

  for (const proc of CANONICAL_PROCESSES) {
    graph.addNode("welding_process", {
      ...proc,
      evidenceIds: [evidenceId],
      verificationStatus: "verified",
    });
  }

  for (const mat of CANONICAL_MATERIALS) {
    graph.addNode("material", {
      ...mat,
      evidenceIds: [],
      verificationStatus: "unverified",
    });
  }

  for (const cons of CANONICAL_CONSUMABLES) {
    graph.addNode("consumable", {
      ...cons,
      evidenceIds: [],
      verificationStatus: "unverified",
    });
  }

  for (const { componentId, portId } of COMPONENT_PORT_WIRING) {
    addRel(graph, {
      type: "component_connects_to_component",
      fromId: componentId,
      toId: portId,
      verificationStatus: "verified",
      confidence: 0.95,
      evidenceIds: [evidenceId],
    });
  }

  for (const [processId, consumableIds] of Object.entries(PROCESS_CONSUMABLES)) {
    for (const consumableId of consumableIds) {
      addRel(graph, {
        type: "process_supports_consumable",
        fromId: processId,
        toId: consumableId,
        verificationStatus: "verified",
        confidence: 0.9,
        evidenceIds: [evidenceId],
      });
    }
  }
}

function buildPolarityConfigurations(graph: KnowledgeGraph): void {
  const seen = new Set<string>();

  for (const raw of polarityRaw as IngestPolarity[]) {
    if (raw.needsReview) continue;
    if (!raw.polarityType || !raw.process) continue;
    if (!raw.groundSocket && !raw.electrodeSocket) continue;

    const processId = INGEST_PROCESS_MAP[raw.process] ?? `process-${raw.process}`;
    const dedupeKey = `${processId}-${raw.polarityType}-${raw.groundSocket}-${raw.electrodeSocket}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const evidenceId = `evidence-${raw.id}`;
    graph.addEvidence(
      provenanceToEvidence(evidenceId, raw.provenance as Provenance, raw.instructions),
    );

    const groundPortId = socketToPortId(raw.groundSocket);
    const electrodePortId = socketToPortId(raw.electrodeSocket);

    const configId = `polarity-${processId}-${raw.polarityType}`;
    const config: PolarityConfiguration = {
      id: configId,
      processId,
      polarityType: raw.polarityType as "DCEP" | "DCEN",
      groundPortId,
      electrodePortId,
      groundCableId: raw.groundSocket ? "cable-ground-clamp" : undefined,
      electrodeCableId: raw.electrodeSocket ? "cable-wire-feed-power" : undefined,
      instructions: raw.instructions,
      evidenceIds: [evidenceId],
      verificationStatus: "verified",
    };
    graph.addNode("polarity_configuration", config);

    const rel = addRel(graph, {
      type: "process_requires_polarity",
      fromId: processId,
      toId: configId,
      verificationStatus: "verified",
      confidence: raw.provenance.confidence,
      evidenceIds: [evidenceId],
    });

    addRel(graph, {
      type: "evidence_supports_relationship",
      fromId: evidenceId,
      toId: rel.id,
      verificationStatus: "verified",
      confidence: raw.provenance.confidence,
      evidenceIds: [evidenceId],
    });

    if (groundPortId) {
      addRel(graph, {
        type: "cable_connects_to_port",
        fromId: "cable-ground-clamp",
        toId: groundPortId,
        verificationStatus: "verified",
        confidence: raw.provenance.confidence,
        evidenceIds: [evidenceId],
        metadata: { processId, polarityType: raw.polarityType },
      });
    }
    if (electrodePortId) {
      addRel(graph, {
        type: "cable_connects_to_port",
        fromId: "cable-wire-feed-power",
        toId: electrodePortId,
        verificationStatus: "verified",
        confidence: raw.provenance.confidence,
        evidenceIds: [evidenceId],
        metadata: { processId, polarityType: raw.polarityType },
      });
    }
  }
}

function buildDutyCycles(graph: KnowledgeGraph): void {
  const seen = new Set<string>();

  for (const raw of dutyCycleRaw as IngestDutyCycle[]) {
    if (raw.needsReview) continue;
    if (!raw.process || !raw.inputVoltage) continue;

    const processId = INGEST_PROCESS_MAP[raw.process] ?? `process-${raw.process}`;
    const key = `${processId}-${raw.inputVoltage}-${raw.dutyPercent}-${raw.amps}-${raw.continuous}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const evidenceId = `evidence-${raw.id}`;
    graph.addEvidence(
      provenanceToEvidence(evidenceId, raw.provenance as Provenance),
    );

    const record: DutyCycleRecord = {
      id: `duty-${processId}-${raw.inputVoltage}-${raw.amps}A`,
      processId,
      inputVoltage: raw.inputVoltage as 120 | 240,
      dutyPercent: raw.dutyPercent,
      amps: raw.amps,
      continuous: raw.continuous ?? false,
      evidenceIds: [evidenceId],
      verificationStatus: toVerificationStatus(raw.provenance.confidence, raw.needsReview),
    };
    graph.addNode("duty_cycle_record", record);
  }
}

function buildTroubleshootingGraph(graph: KnowledgeGraph): void {
  const symptomSeen = new Set<string>();
  const faultSeen = new Set<string>();

  for (const record of getNormalizedTroubleshootingRecords()) {
    const primary = record.sourceEvidence[0];
    if (!primary) continue;

    const evidenceId = `evidence-${record.id}`;
    graph.addEvidence(
      provenanceToEvidence(
        evidenceId,
        {
          source: primary.source,
          page: primary.page,
          section: primary.section,
          extractionMethod: "normalized_troubleshooting",
          confidence: 0.88,
          neighboringText: record.symptom,
        } as Provenance,
        record.symptom,
      ),
    );

    const symId = symptomSlug(record.symptom);
    if (!symptomSeen.has(symId)) {
      symptomSeen.add(symId);
      const symptom: Symptom = {
        id: symId,
        name: record.symptom,
        description: record.symptom,
        observableSigns: record.aliases.slice(0, 10),
        evidenceIds: [evidenceId],
        verificationStatus: "verified",
      };
      graph.addNode("symptom", symptom);
    }

    const causes = record.possibleCause;
    const solutions = record.correctiveAction;

    for (const cause of causes) {
      const fId = faultSlug(cause.slice(0, 80));
      if (!faultSeen.has(fId)) {
        faultSeen.add(fId);
        const fault: Fault = {
          id: fId,
          name: cause.slice(0, 120),
          description: cause,
          processes: record.process,
          evidenceIds: [evidenceId],
          verificationStatus: "verified",
        };
        graph.addNode("fault", fault);
      }

      const sugRel = addRel(graph, {
        type: "symptom_suggests_fault",
        fromId: symId,
        toId: fId,
        verificationStatus: "verified",
        confidence: 0.88,
        evidenceIds: [evidenceId],
      });

      addRel(graph, {
        type: "evidence_supports_relationship",
        fromId: evidenceId,
        toId: sugRel.id,
        verificationStatus: "verified",
        confidence: 0.88,
        evidenceIds: [evidenceId],
      });

      const testId = `test-${fId.slice(0, 40)}`;
      if (!graph.getNode(testId)) {
        const check =
          record.diagnosticCheck.find((d) => d.toLowerCase().includes(cause.slice(0, 20).toLowerCase())) ??
          `Check: ${cause.slice(0, 60)}`;
        const test: DiagnosticTest = {
          id: testId,
          name: check.slice(0, 80),
          instructions: cause,
          evidenceIds: [evidenceId],
          verificationStatus: "verified",
        };
        graph.addNode("diagnostic_test", test);

        addRel(graph, {
          type: "fault_can_be_tested_by_diagnostic_test",
          fromId: fId,
          toId: testId,
          verificationStatus: "verified",
          confidence: 0.85,
          evidenceIds: [evidenceId],
        });
      }
    }

    for (const solution of solutions) {
      const actionId = `action-${symId}-${faultSlug(solution.slice(0, 40)).slice(0, 50)}`;
      if (graph.getNode(actionId)) continue;

      const relatedComponents = CANONICAL_COMPONENTS.filter((c) =>
        solution.toLowerCase().includes(c.name.toLowerCase().split(" ")[0] ?? ""),
      ).map((c) => c.id);

      const action: CorrectiveAction = {
        id: actionId,
        name: solution.slice(0, 80),
        instructions: solution,
        relatedComponentIds: relatedComponents,
        evidenceIds: [evidenceId],
        verificationStatus: "verified",
      };
      graph.addNode("corrective_action", action);

      for (const cause of causes) {
        const fId = faultSlug(cause.slice(0, 80));
        addRel(graph, {
          type: "corrective_action_resolves_fault",
          fromId: actionId,
          toId: fId,
          verificationStatus: "verified",
          confidence: 0.85,
          evidenceIds: [evidenceId],
        });
      }

      for (const compId of relatedComponents) {
        addRel(graph, {
          type: "corrective_action_affects_component",
          fromId: actionId,
          toId: compId,
          verificationStatus: "unverified",
          confidence: 0.6,
          evidenceIds: [evidenceId],
        });
      }

      for (const prerequisite of record.safetyPrerequisites) {
        const constraintId = `safety-prereq-${record.id}-${faultSlug(prerequisite).slice(0, 30)}`;
        if (!graph.getNode(constraintId)) {
          graph.addNode("safety_constraint", {
            id: constraintId,
            text: prerequisite,
            level: "warning",
            appliesTo: [],
            evidenceIds: [evidenceId],
            verificationStatus: "verified",
          });
        }
        addRel(graph, {
          type: "action_requires_safety_constraint",
          fromId: actionId,
          toId: constraintId,
          verificationStatus: "verified",
          confidence: 0.8,
          evidenceIds: [evidenceId],
        });
      }
    }
  }
}

function buildSafetyConstraints(graph: KnowledgeGraph): void {
  const seen = new Set<string>();

  for (const raw of warningsRaw as IngestWarning[]) {
    if (seen.has(raw.text)) continue;
    seen.add(raw.text);

    const evidenceId = `evidence-${raw.id}`;
    if (!graph.getEvidence(evidenceId)) {
      graph.addEvidence(
        provenanceToEvidence(evidenceId, raw.provenance as Provenance, raw.text),
      );
    }

    const constraintId = `safety-${raw.id}`;
    if (graph.getNode(constraintId)) continue;

    const constraint: SafetyConstraint = {
      id: constraintId,
      level: (raw.level as "warning" | "caution" | "danger") ?? "warning",
      text: raw.text,
      appliesTo: ["setup", "diagnose", "weld"],
      evidenceIds: [evidenceId],
      verificationStatus: toVerificationStatus(raw.provenance.confidence, false),
    };
    graph.addNode("safety_constraint", constraint);
  }

  // Link diagnostic/service actions to general safety preamble
  const serviceSafety = (warningsRaw as IngestWarning[]).find((w) =>
    w.text.toLowerCase().includes("turn off, disconnect power"),
  );
  if (serviceSafety) {
    const evidenceId = `evidence-${serviceSafety.id}`;
    const actions = graph.getNodesByType("corrective_action");
    for (const action of actions.slice(0, 20)) {
      addRel(graph, {
        type: "action_requires_safety_constraint",
        fromId: action.id,
        toId: `safety-${serviceSafety.id}`,
        verificationStatus: "verified",
        confidence: 0.85,
        evidenceIds: [evidenceId],
      });
    }
  }
}

function buildSettingsPlaceholders(graph: KnowledgeGraph): void {
  for (const raw of settingsRaw as Array<{
    id: string;
    type: string;
    needsMultimodalInterpretation?: boolean;
    provenance: IngestProvenance;
  }>) {
    const evidenceId = `evidence-${raw.id}`;
    graph.addEvidence(provenanceToEvidence(evidenceId, raw.provenance as Provenance));

    graph.addNode("settings_recommendation", {
      id: raw.id,
      evidenceIds: [evidenceId],
      verificationStatus: "unverified",
      needsMultimodalInterpretation: raw.needsMultimodalInterpretation ?? true,
    });
  }
}

export function buildKnowledgeGraph(): KnowledgeGraph {
  const graph = new KnowledgeGraph();
  buildCanonicalTopology(graph);
  buildPolarityConfigurations(graph);
  buildDutyCycles(graph);
  buildTroubleshootingGraph(graph);
  buildSafetyConstraints(graph);
  buildSettingsPlaceholders(graph);
  return graph;
}

let cachedGraph: KnowledgeGraph | null = null;

export function getKnowledgeGraph(): KnowledgeGraph {
  if (!cachedGraph) {
    cachedGraph = buildKnowledgeGraph();
  }
  return cachedGraph;
}

export function resetKnowledgeGraphCache(): void {
  cachedGraph = null;
}
