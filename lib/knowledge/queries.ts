import { expandQueryTerms } from "@/lib/troubleshooting";
import type { KnowledgeGraph } from "@/lib/knowledge/graph";
import type {
  CorrectiveAction,
  DutyCycleRecord,
  KnowledgeRelationship,
  MachineConfiguration,
  ManualEvidence,
  PolarityConfiguration,
  SafetyConstraint,
  WeldingProcess,
} from "@/lib/knowledge/schemas";

export interface RequiredSetup {
  process: WeldingProcess;
  polarity: PolarityConfiguration | null;
  consumables: string[];
  components: string[];
  dutyCycles: DutyCycleRecord[];
  safetyConstraints: SafetyConstraint[];
  verificationStatus: "verified" | "partial" | "unverified";
  evidenceIds: string[];
}

export interface ConfigurationValidationResult {
  valid: boolean;
  contradictions: ConfigurationContradiction[];
  warnings: string[];
  unverified: string[];
}

export interface ConfigurationContradiction {
  type: "polarity_mismatch" | "process_consumable" | "voltage_unknown" | "conflicting_polarity";
  message: string;
  expected?: string;
  stated?: string;
  evidenceIds: string[];
  verificationStatus: "verified" | "unverified";
}

export function getRequiredSetup(
  graph: KnowledgeGraph,
  processId: string,
): RequiredSetup | null {
  const process = graph.getTypedNode(processId, "welding_process");
  if (!process) return null;

  const polarityRels = graph.getOutgoing(processId, "process_requires_polarity");
  const polarityConfigs = polarityRels
    .map((r) => graph.getTypedNode(r.toId, "polarity_configuration"))
    .filter((p): p is PolarityConfiguration => p != null);

  const verifiedPolarity = polarityConfigs.find((p) => p.verificationStatus === "verified") ?? null;

  const consumableRels = graph.getOutgoing(processId, "process_supports_consumable");
  const consumables = consumableRels.map((r) => r.toId);

  const componentRels = graph.getOutgoing(processId, "process_requires_component");
  const components = componentRels.map((r) => r.toId);

  const dutyCycles = graph
    .getNodesByType("duty_cycle_record")
    .filter((d) => d.processId === processId);

  const safetyConstraints = graph.getNodesByType("safety_constraint").slice(0, 10);

  const evidenceIds = [
    ...process.evidenceIds,
    ...(verifiedPolarity?.evidenceIds ?? []),
    ...dutyCycles.flatMap((d) => d.evidenceIds),
  ];

  const hasVerifiedPolarity = verifiedPolarity != null;
  const verificationStatus =
    hasVerifiedPolarity && dutyCycles.some((d) => d.verificationStatus === "verified")
      ? "verified"
      : hasVerifiedPolarity || dutyCycles.length > 0
        ? "partial"
        : "unverified";

  return {
    process,
    polarity: verifiedPolarity,
    consumables,
    components,
    dutyCycles,
    safetyConstraints,
    verificationStatus,
    evidenceIds: [...new Set(evidenceIds)],
  };
}

export function findFaultsForSymptom(graph: KnowledgeGraph, symptomId: string) {
  const rels = graph.getOutgoing(symptomId, "symptom_suggests_fault");
  return rels.map((rel) => ({
    fault: graph.getTypedNode(rel.toId, "fault"),
    relationship: rel,
    evidence: getEvidenceForRelationship(graph, rel.id),
  }));
}

export function findActionsForComponent(graph: KnowledgeGraph, componentId: string) {
  const rels = graph.getIncoming(componentId, "corrective_action_affects_component");
  return rels.map((rel) => ({
    action: graph.getTypedNode(rel.fromId, "corrective_action"),
    relationship: rel,
    evidence: getEvidenceForRelationship(graph, rel.id),
  }));
}

export function getSafetyPrerequisites(
  graph: KnowledgeGraph,
  actionId: string,
): SafetyConstraint[] {
  const rels = graph.getOutgoing(actionId, "action_requires_safety_constraint");
  return rels
    .map((r) => graph.getTypedNode(r.toId, "safety_constraint"))
    .filter((s): s is SafetyConstraint => s != null);
}

export function getEvidenceForRelationship(
  graph: KnowledgeGraph,
  relationshipId: string,
): ManualEvidence[] {
  const rel = graph.getRelationships().find((r) => r.id === relationshipId);
  if (!rel) return [];

  const directEvidence = rel.evidenceIds
    .map((id) => graph.getEvidence(id))
    .filter((e): e is ManualEvidence => e != null);

  const supportRels = graph.getIncoming(relationshipId, "evidence_supports_relationship");
  const supportedEvidence = supportRels
    .flatMap((r) => r.evidenceIds)
    .map((id) => graph.getEvidence(id))
    .filter((e): e is ManualEvidence => e != null);

  const byId = new Map<string, ManualEvidence>();
  for (const e of [...directEvidence, ...supportedEvidence]) {
    byId.set(e.id, e);
  }
  return Array.from(byId.values());
}

export function validateConfiguration(
  graph: KnowledgeGraph,
  config: MachineConfiguration,
): ConfigurationValidationResult {
  const contradictions: ConfigurationContradiction[] = [];
  const warnings: string[] = [];
  const unverified: string[] = [];

  if (!config.processId) {
    warnings.push("No welding process specified.");
    return { valid: false, contradictions, warnings, unverified };
  }

  const required = getRequiredSetup(graph, config.processId);
  if (!required) {
    warnings.push(`Unknown process: ${config.processId}`);
    return { valid: false, contradictions, warnings, unverified };
  }

  if (required.polarity && config.polarityConfigId) {
    const stated = graph.getTypedNode(config.polarityConfigId, "polarity_configuration");
    if (stated && stated.id !== required.polarity.id) {
      contradictions.push({
        type: "polarity_mismatch",
        message: `Stated polarity config does not match required config for ${required.process.name}.`,
        expected: required.polarity.id,
        stated: stated.id,
        evidenceIds: required.polarity.evidenceIds,
        verificationStatus: required.polarity.verificationStatus === "verified" ? "verified" : "unverified",
      });
    }
  }

  if (required.polarity && !config.polarityConfigId) {
    unverified.push(
      `Polarity not specified. Manual requires ${required.polarity.polarityType} for ${required.process.name}.`,
    );
  }

  if (required.verificationStatus === "unverified") {
    unverified.push(`Setup requirements for ${required.process.name} are not fully verified in manual data.`);
  }

  for (const consumableId of config.consumableIds ?? []) {
    if (!required.consumables.includes(consumableId)) {
      contradictions.push({
        type: "process_consumable",
        message: `Consumable ${consumableId} may not be supported for ${required.process.name}.`,
        stated: consumableId,
        evidenceIds: required.evidenceIds,
        verificationStatus: "unverified",
      });
    }
  }

  return {
    valid: contradictions.filter((c) => c.verificationStatus === "verified").length === 0,
    contradictions,
    warnings,
    unverified,
  };
}

export function findContradictions(
  graph: KnowledgeGraph,
  stated: MachineConfiguration,
): ConfigurationContradiction[] {
  const validation = validateConfiguration(graph, stated);
  const extra: ConfigurationContradiction[] = [];

  if (!stated.processId) return validation.contradictions;

  const required = getRequiredSetup(graph, stated.processId);
  if (!required?.polarity) return validation.contradictions;

  // Infer polarity from cable-port relationships if user specified process only
  const polarityRels = graph
    .getRelationships({ type: "cable_connects_to_port" })
    .filter((r) => r.metadata?.processId === stated.processId);

  if (polarityRels.length > 0) {
    const groundRel = polarityRels.find((r) => r.fromId === "cable-ground-clamp");
    const expectedGround = required.polarity.groundPortId;
    if (groundRel && expectedGround && groundRel.toId !== expectedGround) {
      extra.push({
        type: "conflicting_polarity",
        message: `Ground clamp cable placement may conflict with ${required.process.name} requirements.`,
        expected: expectedGround,
        stated: groundRel.toId,
        evidenceIds: required.polarity.evidenceIds,
        verificationStatus: groundRel.verificationStatus === "verified" ? "verified" : "unverified",
      });
    }
  }

  return [...validation.contradictions, ...extra];
}

export function findSymptomByName(graph: KnowledgeGraph, name: string) {
  const terms = expandQueryTerms(name);
  const nodes = graph.getNodesByType("symptom");

  for (const symptom of nodes) {
    const haystack = [
      symptom.name,
      symptom.description ?? "",
      ...(symptom.observableSigns ?? []),
    ]
      .join(" ")
      .toLowerCase();
    if (terms.some((t) => haystack.includes(t))) return symptom;
  }

  const lower = name.toLowerCase();
  return nodes.find((s) => s.name.toLowerCase().includes(lower));
}

export function getDiagnosticTestsForFault(graph: KnowledgeGraph, faultId: string) {
  return graph
    .getOutgoing(faultId, "fault_can_be_tested_by_diagnostic_test")
    .map((rel) => ({
      test: graph.getTypedNode(rel.toId, "diagnostic_test"),
      relationship: rel,
      evidence: getEvidenceForRelationship(graph, rel.id),
    }));
}

export function getCorrectiveActionsForFault(graph: KnowledgeGraph, faultId: string) {
  return graph
    .getIncoming(faultId, "corrective_action_resolves_fault")
    .map((rel) => ({
      action: graph.getTypedNode(rel.fromId, "corrective_action") as CorrectiveAction | undefined,
      relationship: rel,
      evidence: getEvidenceForRelationship(graph, rel.id),
    }))
    .filter((x) => x.action != null);
}

export function getRelationshipsWithEvidence(
  graph: KnowledgeGraph,
  filter?: { type?: KnowledgeRelationship["type"] },
) {
  return graph
    .getRelationships(filter)
    .map((rel) => ({
      relationship: rel,
      evidence: getEvidenceForRelationship(graph, rel.id),
    }));
}
