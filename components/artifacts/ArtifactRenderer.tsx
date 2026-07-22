"use client";

import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import { PolarityDiagramArtifact } from "@/components/artifacts/renderers/PolarityDiagramArtifact";
import { CableRoutingDiagramArtifact } from "@/components/artifacts/renderers/CableRoutingDiagramArtifact";
import { DutyCycleCalculatorArtifact } from "@/components/artifacts/renderers/DutyCycleCalculatorArtifact";
import { SettingsConfiguratorArtifact } from "@/components/artifacts/renderers/SettingsConfiguratorArtifact";
import { TroubleshootingFlowArtifact } from "@/components/artifacts/renderers/TroubleshootingFlowArtifact";
import { DiagnosticHypothesisBoardArtifact } from "@/components/artifacts/renderers/DiagnosticHypothesisBoardArtifact";
import { ManualFigureArtifact } from "@/components/artifacts/renderers/ManualFigureArtifact";
import { AnnotatedManualFigureArtifact } from "@/components/artifacts/renderers/AnnotatedManualFigureArtifact";
import { ComponentMapArtifact } from "@/components/artifacts/renderers/ComponentMapArtifact";
import { StepByStepChecklistArtifact } from "@/components/artifacts/renderers/StepByStepChecklistArtifact";
import { WeldDefectComparisonArtifact } from "@/components/artifacts/renderers/WeldDefectComparisonArtifact";
import { ConfigurationSummaryArtifact } from "@/components/artifacts/renderers/ConfigurationSummaryArtifact";
import { ArtifactPlaceholder } from "@/components/artifacts/ArtifactPlaceholder";

interface ArtifactRendererProps {
  spec: ArtifactSpec;
}

export function ArtifactRenderer({ spec }: ArtifactRendererProps) {
  switch (spec.type) {
    case "polarity-diagram":
      return <PolarityDiagramArtifact spec={spec} />;
    case "cable-routing-diagram":
      return <CableRoutingDiagramArtifact spec={spec} />;
    case "duty-cycle-calculator":
      return <DutyCycleCalculatorArtifact spec={spec} />;
    case "settings-configurator":
      return <SettingsConfiguratorArtifact spec={spec} />;
    case "troubleshooting-flow":
      return <TroubleshootingFlowArtifact spec={spec} />;
    case "diagnostic-hypothesis-board":
      return <DiagnosticHypothesisBoardArtifact spec={spec} />;
    case "manual-figure":
      return <ManualFigureArtifact spec={spec} />;
    case "annotated-manual-figure":
      return <AnnotatedManualFigureArtifact spec={spec} />;
    case "component-map":
      return <ComponentMapArtifact spec={spec} />;
    case "step-by-step-checklist":
      return <StepByStepChecklistArtifact spec={spec} />;
    case "weld-defect-comparison":
      return <WeldDefectComparisonArtifact spec={spec} />;
    case "configuration-summary":
      return <ConfigurationSummaryArtifact spec={spec} />;
    case "placeholder":
      return <ArtifactPlaceholder spec={spec} />;
    default: {
      const unknownType =
        spec && typeof spec === "object" && "type" in spec
          ? String((spec as { type: unknown }).type)
          : "unknown";
      return (
        <ArtifactPlaceholder
          spec={{
            type: "placeholder",
            title: "Artifact could not be shown",
            description: `This artifact type (${unknownType}) failed validation or is not supported. Retry the question, or open the cited manual page from Grounding & evidence.`,
          }}
        />
      );
    }
  }
}
