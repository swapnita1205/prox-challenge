import { z } from "zod";

/** Shared provenance from manual extraction */
export const ProvenanceSchema = z.object({
  source: z.string(),
  page: z.number(),
  section: z.string().optional(),
  bbox: z.array(z.number()).optional(),
  extractionMethod: z.string(),
  confidence: z.number().min(0).max(1),
  neighboringText: z.string().optional(),
  assetPath: z.string().optional(),
});

export type Provenance = z.infer<typeof ProvenanceSchema>;

export const VerificationStatusSchema = z.enum(["verified", "unverified", "conflicting"]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const ManualEvidenceSchema = z.object({
  id: z.string(),
  provenance: ProvenanceSchema,
  excerpt: z.string().optional(),
  assetPath: z.string().optional(),
});

export type ManualEvidence = z.infer<typeof ManualEvidenceSchema>;

export const MachineComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  location: z.enum(["front_panel", "interior", "rear", "torch", "workpiece"]).optional(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("verified"),
});

export type MachineComponent = z.infer<typeof MachineComponentSchema>;

export const PortSchema = z.object({
  id: z.string(),
  name: z.string(),
  polarity: z.enum(["positive", "negative", "ground", "neutral"]).optional(),
  label: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("verified"),
});

export type Port = z.infer<typeof PortSchema>;

export const CableSchema = z.object({
  id: z.string(),
  name: z.string(),
  connectsFrom: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("verified"),
});

export type Cable = z.infer<typeof CableSchema>;

export const WeldingProcessSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.enum(["mig", "mig-solid", "flux", "tig", "stick"]),
  description: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("verified"),
});

export type WeldingProcess = z.infer<typeof WeldingProcessSchema>;

export const MachineConfigurationSchema = z.object({
  id: z.string(),
  processId: z.string().optional(),
  inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
  polarityConfigId: z.string().optional(),
  materialId: z.string().optional(),
  consumableIds: z.array(z.string()).default([]),
  componentIds: z.array(z.string()).default([]),
});

export type MachineConfiguration = z.infer<typeof MachineConfigurationSchema>;

export const ConsumableSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["wire", "gas", "electrode", "flux_core_wire", "solid_wire"]),
  specifications: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type Consumable = z.infer<typeof ConsumableSchema>;

export const MaterialSchema = z.object({
  id: z.string(),
  name: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type Material = z.infer<typeof MaterialSchema>;

export const FaultSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  processes: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type Fault = z.infer<typeof FaultSchema>;

export const SymptomSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  observableSigns: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type Symptom = z.infer<typeof SymptomSchema>;

export const ObservationSchema = z.object({
  id: z.string(),
  description: z.string(),
  symptomId: z.string().optional(),
  reportedAt: z.number().optional(),
});

export type Observation = z.infer<typeof ObservationSchema>;

export const DiagnosticTestSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.string(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type DiagnosticTest = z.infer<typeof DiagnosticTestSchema>;

export const CorrectiveActionSchema = z.object({
  id: z.string(),
  name: z.string(),
  instructions: z.string(),
  relatedComponentIds: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type CorrectiveAction = z.infer<typeof CorrectiveActionSchema>;

export const SafetyConstraintSchema = z.object({
  id: z.string(),
  level: z.enum(["warning", "caution", "danger"]),
  text: z.string(),
  appliesTo: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("verified"),
});

export type SafetyConstraint = z.infer<typeof SafetyConstraintSchema>;

export const SettingsRecommendationSchema = z.object({
  id: z.string(),
  processId: z.string().optional(),
  materialId: z.string().optional(),
  thickness: z.string().optional(),
  voltage: z.string().optional(),
  wireSpeed: z.string().optional(),
  gas: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
  needsMultimodalInterpretation: z.boolean().default(true),
});

export type SettingsRecommendation = z.infer<typeof SettingsRecommendationSchema>;

export const DutyCycleRecordSchema = z.object({
  id: z.string(),
  processId: z.string(),
  inputVoltage: z.union([z.literal(120), z.literal(240)]),
  dutyPercent: z.number(),
  amps: z.number(),
  continuous: z.boolean().default(false),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type DutyCycleRecord = z.infer<typeof DutyCycleRecordSchema>;

export const PolarityConfigurationSchema = z.object({
  id: z.string(),
  processId: z.string(),
  polarityType: z.enum(["DCEP", "DCEN"]),
  groundPortId: z.string().optional(),
  electrodePortId: z.string().optional(),
  groundCableId: z.string().optional(),
  electrodeCableId: z.string().optional(),
  instructions: z.string().optional(),
  evidenceIds: z.array(z.string()).default([]),
  verificationStatus: VerificationStatusSchema.default("unverified"),
});

export type PolarityConfiguration = z.infer<typeof PolarityConfigurationSchema>;

/** Graph relationship types */
export const RelationshipTypeSchema = z.enum([
  "component_connects_to_component",
  "cable_connects_to_port",
  "process_requires_polarity",
  "process_supports_consumable",
  "symptom_suggests_fault",
  "fault_can_be_tested_by_diagnostic_test",
  "corrective_action_resolves_fault",
  "action_requires_safety_constraint",
  "configuration_conflicts_with_configuration",
  "evidence_supports_relationship",
  "process_requires_component",
  "fault_caused_by_component",
  "corrective_action_affects_component",
]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const KnowledgeRelationshipSchema = z.object({
  id: z.string(),
  type: RelationshipTypeSchema,
  fromId: z.string(),
  toId: z.string(),
  verificationStatus: VerificationStatusSchema,
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export type KnowledgeRelationship = z.infer<typeof KnowledgeRelationshipSchema>;

export const NodeTypeSchema = z.enum([
  "machine_component",
  "port",
  "cable",
  "welding_process",
  "machine_configuration",
  "consumable",
  "material",
  "fault",
  "symptom",
  "observation",
  "diagnostic_test",
  "corrective_action",
  "safety_constraint",
  "manual_evidence",
  "settings_recommendation",
  "duty_cycle_record",
  "polarity_configuration",
]);

export type NodeType = z.infer<typeof NodeTypeSchema>;

export const KnowledgeNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  data: z.record(z.unknown()),
});

export type KnowledgeNode = z.infer<typeof KnowledgeNodeSchema>;

export const KnowledgeGraphSnapshotSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  nodes: z.array(KnowledgeNodeSchema),
  relationships: z.array(KnowledgeRelationshipSchema),
  evidence: z.array(ManualEvidenceSchema),
  stats: z.object({
    nodeCount: z.number(),
    relationshipCount: z.number(),
    verifiedRelationships: z.number(),
    unverifiedRelationships: z.number(),
  }),
});

export type KnowledgeGraphSnapshot = z.infer<typeof KnowledgeGraphSnapshotSchema>;

/** Union of typed entity payloads keyed by node type */
export type EntityMap = {
  machine_component: MachineComponent;
  port: Port;
  cable: Cable;
  welding_process: WeldingProcess;
  machine_configuration: MachineConfiguration;
  consumable: Consumable;
  material: Material;
  fault: Fault;
  symptom: Symptom;
  observation: Observation;
  diagnostic_test: DiagnosticTest;
  corrective_action: CorrectiveAction;
  safety_constraint: SafetyConstraint;
  manual_evidence: ManualEvidence;
  settings_recommendation: SettingsRecommendation;
  duty_cycle_record: DutyCycleRecord;
  polarity_configuration: PolarityConfiguration;
};
