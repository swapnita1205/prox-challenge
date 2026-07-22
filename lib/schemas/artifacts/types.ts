import { z } from "zod";
import {
  ArtifactMetaSchema,
  ProcessSlugSchema,
  SocketPolaritySchema,
} from "@/lib/schemas/artifacts/base";

export const PolarityDiagramArtifactSchema = z
  .object({
    type: z.literal("polarity-diagram"),
    process: ProcessSlugSchema,
    polarityType: z.enum(["DCEP", "DCEN"]).optional(),
    groundSocket: z.enum(["positive", "negative", "workpiece"]),
    electrodeSocket: z.enum(["positive", "negative", "torch"]),
    groundLabel: z.string().default("Ground Clamp"),
    electrodeLabel: z.string().default("Electrode / Torch"),
  })
  .merge(ArtifactMetaSchema);

export const CableRoutingDiagramArtifactSchema = z
  .object({
    type: z.literal("cable-routing-diagram"),
    process: ProcessSlugSchema,
    routes: z.array(
      z.object({
        id: z.string(),
        cable: z.string(),
        from: z.string(),
        to: z.string(),
        socket: z.enum(["positive", "negative", "mig-gun", "workpiece"]).optional(),
        color: z.enum(["orange", "blue", "neutral"]).optional(),
      }),
    ),
  })
  .merge(ArtifactMetaSchema);

export const DutyCycleCalculatorArtifactSchema = z
  .object({
    type: z.literal("duty-cycle-calculator"),
    process: z.enum(["mig", "tig", "stick", "flux"]),
    voltage: z.union([z.literal(120), z.literal(240)]),
    defaultAmps: z.number().optional(),
    ratedDutyPercent: z.number().optional(),
    ratedAmps: z.number().optional(),
    continuousAmps: z.number().optional(),
  })
  .merge(ArtifactMetaSchema);

export const SettingsConfiguratorArtifactSchema = z
  .object({
    type: z.literal("settings-configurator"),
    process: z.enum(["mig", "flux", "tig", "stick"]).optional(),
    material: z.string().optional(),
    thickness: z.string().optional(),
    wireType: z.string().optional(),
    wireDiameter: z.string().optional(),
    gas: z.string().optional(),
    inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
    recommended: z
      .object({
        voltage: z.string().optional(),
        wireSpeed: z.string().optional(),
        gasFlow: z.string().optional(),
        amperage: z.string().optional(),
        notes: z.string().optional(),
        recommendationStatus: z
          .enum(["resolved", "multimodal_required", "partial", "unsupported", "conflicting"])
          .optional(),
        thicknessOriginal: z.string().optional(),
        thicknessNormalized: z.string().optional(),
        polarity: z.string().optional(),
      })
      .optional(),
    setupChecklist: z
      .array(z.object({ id: z.string(), label: z.string(), completed: z.boolean().default(false) }))
      .default([]),
    polarityRef: z
      .object({
        groundSocket: SocketPolaritySchema,
        electrodeSocket: SocketPolaritySchema,
        polarityType: z.enum(["DCEP", "DCEN"]).optional(),
      })
      .optional(),
    supportingEvidence: z.array(z.string()).default([]),
  })
  .merge(ArtifactMetaSchema);

export const TroubleshootingFlowArtifactSchema = z
  .object({
    type: z.literal("troubleshooting-flow"),
    currentQuestion: z.string(),
    observations: z.array(z.string()).default([]),
    branches: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(["question", "cause", "action", "outcome"]),
        nextId: z.string().optional(),
      }),
    ),
    eliminatedCauses: z.array(z.string()).default([]),
    nextRecommendedCheck: z.string().optional(),
    currentNodeId: z.string().optional(),
  })
  .merge(ArtifactMetaSchema);

export const DiagnosticHypothesisBoardArtifactSchema = z
  .object({
    type: z.literal("diagnostic-hypothesis-board"),
    hypotheses: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        confidence: z.number().min(0).max(1),
        evidenceFor: z.array(z.string()).default([]),
        evidenceAgainst: z.array(z.string()).default([]),
        missingObservation: z.string().optional(),
        ruledOut: z.boolean().optional(),
      }),
    ),
    evidenceSummary: z.string().optional(),
  })
  .merge(ArtifactMetaSchema);

export const ManualFigureArtifactSchema = z
  .object({
    type: z.literal("manual-figure"),
    assetId: z.string(),
    source: z.string(),
    page: z.number(),
    caption: z.string(),
    figureId: z.string().optional(),
    imagePath: z.string().optional(),
    fallbackNote: z.string().optional(),
  })
  .merge(ArtifactMetaSchema);

export const AnnotatedManualFigureArtifactSchema = z
  .object({
    type: z.literal("annotated-manual-figure"),
    assetId: z.string(),
    source: z.string(),
    page: z.number(),
    caption: z.string(),
    figureId: z.string().optional(),
    imagePath: z.string().optional(),
    fallbackNote: z.string().optional(),
    regions: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        width: z.number().min(0).max(100),
        height: z.number().min(0).max(100),
        description: z.string().optional(),
      }),
    ),
    callouts: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          targetRegionId: z.string().optional(),
        }),
      )
      .default([]),
  })
  .merge(ArtifactMetaSchema);

export const ComponentMapArtifactSchema = z
  .object({
    type: z.literal("component-map"),
    view: z.enum(["front_panel", "interior", "rear"]).default("front_panel"),
    components: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        description: z.string().optional(),
        highlighted: z.boolean().optional(),
      }),
    ),
  })
  .merge(ArtifactMetaSchema);

export const StepByStepChecklistArtifactSchema = z
  .object({
    type: z.literal("step-by-step-checklist"),
    steps: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        detail: z.string().optional(),
        completed: z.boolean().default(false),
        safetyCritical: z.boolean().optional(),
      }),
    ),
  })
  .merge(ArtifactMetaSchema);

export const WeldDefectComparisonArtifactSchema = z
  .object({
    type: z.literal("weld-defect-comparison"),
    defectName: z.string(),
    userDescription: z.string().optional(),
    exemplars: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
        assetId: z.string().optional(),
        source: z.string().optional(),
        page: z.number().optional(),
        matchScore: z.number().min(0).max(1).optional(),
      }),
    ),
    selectedExemplarId: z.string().optional(),
    userImage: z
      .object({
        imageId: z.string(),
        regions: z
          .array(
            z.object({
              id: z.string(),
              label: z.string(),
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
              description: z.string().optional(),
            }),
          )
          .default([]),
        callouts: z
          .array(
            z.object({
              id: z.string(),
              label: z.string(),
              x: z.number(),
              y: z.number(),
              targetRegionId: z.string().optional(),
            }),
          )
          .default([]),
      })
      .optional(),
    recommendedNextStep: z.string().optional(),
    uncertaintyNotes: z.array(z.string()).default([]),
    possibleCategories: z.array(z.string()).default([]),
    visualObservations: z.array(z.string()).default([]),
    potentialCauses: z.array(z.string()).default([]),
  })
  .merge(ArtifactMetaSchema);

export const ConfigurationSummaryArtifactSchema = z
  .object({
    type: z.literal("configuration-summary"),
    process: z.string(),
    inputVoltage: z.union([z.literal(120), z.literal(240)]).optional(),
    polarity: z.string().optional(),
    consumables: z.array(z.string()).default([]),
    components: z.array(z.string()).default([]),
    validationStatus: z.enum(["verified", "partial", "unverified", "invalid"]),
    warnings: z.array(z.string()).default([]),
    contradictions: z.array(z.string()).default([]),
  })
  .merge(ArtifactMetaSchema);

export const PlaceholderArtifactSchema = z.object({
  type: z.literal("placeholder"),
  title: z.string(),
  description: z.string(),
});

export const ArtifactSpecSchema = z.discriminatedUnion("type", [
  PolarityDiagramArtifactSchema,
  CableRoutingDiagramArtifactSchema,
  DutyCycleCalculatorArtifactSchema,
  SettingsConfiguratorArtifactSchema,
  TroubleshootingFlowArtifactSchema,
  DiagnosticHypothesisBoardArtifactSchema,
  ManualFigureArtifactSchema,
  AnnotatedManualFigureArtifactSchema,
  ComponentMapArtifactSchema,
  StepByStepChecklistArtifactSchema,
  WeldDefectComparisonArtifactSchema,
  ConfigurationSummaryArtifactSchema,
  PlaceholderArtifactSchema,
]);

export type ArtifactSpec = z.infer<typeof ArtifactSpecSchema>;

export const ArtifactInstanceSchema = z.object({
  id: z.string(),
  spec: ArtifactSpecSchema,
  createdAt: z.number(),
});

export type ArtifactInstance = z.infer<typeof ArtifactInstanceSchema>;

// Re-export legacy schema names for gradual migration
export type PolarityDiagramSpec = z.infer<typeof PolarityDiagramArtifactSchema>;
export type DutyCycleCalculatorSpec = z.infer<typeof DutyCycleCalculatorArtifactSchema>;
