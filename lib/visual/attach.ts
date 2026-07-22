import type { AgentContext } from "@/lib/agent/context";
import { addArtifact } from "@/lib/agent/context";
import { validateArtifactSpec } from "@/lib/artifacts/registry";
import { buildSettingsConfiguratorArtifact, resolveSettings } from "@/lib/settings";
import {
  buildAnnotatedManualFigureArtifact,
  buildComponentMapArtifact,
  buildManualFigureArtifact,
  buildWeldDefectComparisonFromManual,
  resolveTargetFigure,
  selectVisualArtifactTypes,
  shouldAttachVisual,
} from "@/lib/visual/policy";
import type { VisualPolicyInput, VisualArtifactType } from "@/lib/visual/types";

function pushArtifact(ctx: AgentContext, spec: unknown): boolean {
  const validated = validateArtifactSpec(spec);
  if (!validated) return false;
  addArtifact(ctx, validated);
  return true;
}

/**
 * Deterministically attach visual artifacts to the agent context.
 * Does not rely on the LLM to decide when an obvious manual visual is needed.
 */
export function applyVisualArtifactPolicy(
  ctx: AgentContext,
  input: VisualPolicyInput,
): string[] {
  const have = new Set(ctx.artifacts.map((a) => a.type));
  const types = selectVisualArtifactTypes(input);
  const attached: string[] = [];

  if (types.length === 0 && !shouldAttachVisual(input)) {
    return attached;
  }

  const figure = resolveTargetFigure(input);
  const citations = ctx.citations.length > 0 ? ctx.citations : undefined;

  for (const type of types) {
    if (have.has(type)) continue;

    switch (type as VisualArtifactType) {
      case "manual-figure": {
        const target =
          figure ??
          (input.acceptedPages?.[0]
            ? resolveTargetFigure({
                ...input,
                query: `${input.query} page ${input.acceptedPages[0].page}`,
              })
            : null);
        if (!target) break;
        if (
          pushArtifact(
            ctx,
            buildManualFigureArtifact(target, { citations, query: input.query }),
          )
        ) {
          attached.push(type);
          have.add(type);
        }
        break;
      }
      case "annotated-manual-figure": {
        if (!figure) break;
        const annotated = buildAnnotatedManualFigureArtifact(figure, citations);
        if (annotated && pushArtifact(ctx, annotated)) {
          attached.push(type);
          have.add(type);
        }
        break;
      }
      case "weld-defect-comparison": {
        const page =
          input.acceptedPages?.find((p) => (p.source ?? "owner-manual.pdf") === "owner-manual.pdf")
            ?.page ?? 37;
        if (pushArtifact(ctx, buildWeldDefectComparisonFromManual(input.query, page))) {
          attached.push(type);
          have.add(type);
        }
        break;
      }
      case "component-map": {
        const page =
          input.acceptedPages?.find((p) => p.page === 8)?.page ??
          (/panel|control/i.test(input.query) ? 8 : 8);
        if (pushArtifact(ctx, buildComponentMapArtifact(input.query, page))) {
          attached.push(type);
          have.add(type);
        }
        break;
      }
      case "polarity-diagram": {
        if (
          pushArtifact(ctx, {
            type: "polarity-diagram",
            title: "Polarity",
            process: /tig/i.test(input.query) ? "tig" : "mig-solid",
            polarityType: /tig/i.test(input.query) ? "DCEN" : "DCEP",
            groundSocket: /tig/i.test(input.query) ? "positive" : "negative",
            electrodeSocket: /tig/i.test(input.query) ? "negative" : "positive",
            groundLabel: "Ground Clamp",
            electrodeLabel: /tig/i.test(input.query) ? "TIG Torch" : "MIG Gun",
            citations: citations?.slice(0, 2) ?? [{ source: "owner-manual.pdf", page: 14 }],
            confidence: "high",
          })
        ) {
          attached.push(type);
          have.add(type);
        }
        break;
      }
      case "cable-routing-diagram": {
        if (
          pushArtifact(ctx, {
            type: "cable-routing-diagram",
            title: "Cable Routing",
            process: /tig/i.test(input.query) ? "tig" : "mig-solid",
            routes: /tig/i.test(input.query)
              ? [
                  {
                    id: "r-ground",
                    cable: "Ground Clamp Cable",
                    from: "Ground Clamp",
                    to: "Positive (+) Socket",
                    socket: "positive",
                    color: "orange",
                  },
                  {
                    id: "r-torch",
                    cable: "TIG Torch Cable",
                    from: "TIG Torch",
                    to: "Negative (−) Socket",
                    socket: "negative",
                    color: "blue",
                  },
                ]
              : [
                  {
                    id: "r-ground",
                    cable: "Ground Clamp Cable",
                    from: "Ground Clamp",
                    to: "Negative (−) Socket",
                    socket: "negative",
                    color: "orange",
                  },
                  {
                    id: "r-gun",
                    cable: "MIG Gun Cable",
                    from: "MIG Gun",
                    to: "Positive (+) Socket",
                    socket: "positive",
                    color: "blue",
                  },
                ],
            citations: citations?.slice(0, 2) ?? [{ source: "owner-manual.pdf", page: 24 }],
            confidence: "high",
          })
        ) {
          attached.push(type);
          have.add(type);
        }
        break;
      }
      case "settings-configurator": {
        const resolution = resolveSettings({ query: input.query });
        const artifact =
          buildSettingsConfiguratorArtifact(resolution) ??
          ({
            type: "settings-configurator",
            title: "Settings",
            description: resolution.naturalLanguageAnswer,
            process: resolution.process,
            material: resolution.material,
            thickness: resolution.thicknessNormalized?.label ?? resolution.thickness,
            inputVoltage: resolution.inputVoltage,
            recommended: { notes: resolution.naturalLanguageAnswer },
            citations: resolution.citations,
            confidence: "low",
          } as const);
        if (pushArtifact(ctx, artifact)) {
          attached.push(type);
          have.add(type);
        }
        break;
      }
      default:
        break;
    }
  }

  return attached;
}
