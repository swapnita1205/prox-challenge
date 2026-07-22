import pagesData from "@/data/generated/pages.json";
import figuresData from "@/data/generated/figures.json";
import { getKnowledgeGraph } from "@/lib/knowledge/build";
import {
  findFaultsForSymptom,
  findSymptomByName,
  getRequiredSetup,
  validateConfiguration,
  getSafetyPrerequisites,
} from "@/lib/knowledge/queries";
import { INGEST_PROCESS_MAP } from "@/lib/knowledge/canonical";
import { retrieve } from "@/lib/retrieval/engine";
import { getPageRenderPath } from "@/lib/retrieval/search";
import { getAssetById } from "@/lib/manual/assets";
import { validateArtifactSpec } from "@/lib/artifacts/registry";
import {
  applyVisualArtifactPolicy,
  buildManualFigureArtifact,
  loadFigureCandidates,
  shouldAttachVisual,
} from "@/lib/visual";
import { validateSafetyContext } from "@/lib/safety/validate";
import {
  buildSettingsConfiguratorArtifact,
  resolveSettings,
  type SettingsLookupInput,
} from "@/lib/settings";
import { calculateDutyCycle } from "@/lib/agent/calculations/duty-cycle";
import {
  getDiagnosticSession,
  sessionToDiagnosticState,
  startDiagnosticSession,
  updateDiagnosticSession,
} from "@/lib/agent/diagnostic-session";
import type { AgentContext } from "@/lib/agent/context";
import {
  addArtifact,
  addCitations,
  addToolSummary,
  recordToolTiming,
} from "@/lib/agent/context";
import type { Citation } from "@/lib/schemas/conversation";

const DEFAULT_SEARCH_LIMIT = 5;
const PAGE_TEXT_LIMIT = 1600;

/** Compact JSON — pretty-print wastes tokens on every subsequent agent turn. */
function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  };
}

function timed<T>(
  ctx: AgentContext,
  toolName: string,
  category: "retrieval" | "safety" | "artifact" | "other",
  fn: () => T,
): T {
  const start = Date.now();
  try {
    return fn();
  } finally {
    recordToolTiming(ctx, toolName, Date.now() - start, category);
  }
}

function bundleToCitations(bundle: ReturnType<typeof retrieve>): Citation[] {
  return bundle.citations.map((c) => ({
    source: c.source,
    page: c.page,
    section: c.section,
    excerpt: c.excerpt,
    assetId: c.assetId,
  }));
}

export function handleSearchManual(
  ctx: AgentContext,
  input: { query: string; limit?: number },
) {
  return timed(ctx, "search_manual", "retrieval", () => {
    const limit = input.limit ?? DEFAULT_SEARCH_LIMIT;
    const cacheKey = `${input.query}::${limit}`;
    const cached = ctx.retrievalCache.get(cacheKey);
    if (cached) {
      addToolSummary(ctx, `search_manual: cache hit for "${input.query}"`);
      return textResult(cached);
    }

    const bundle = retrieve(input.query, { limitPerTask: limit });
    const citations = bundleToCitations(bundle);
    addCitations(ctx, citations);
    addToolSummary(
      ctx,
      `search_manual: ${bundle.citations.length} citations for "${input.query}"`,
    );

    if (shouldAttachVisual({ query: input.query, citations })) {
      applyVisualArtifactPolicy(ctx, {
        query: input.query,
        citations,
        retrievalBundle: bundle,
      });
    }

    const payload = {
      query: input.query,
      dimensions: bundle.dimensions,
      ambiguities: bundle.ambiguities,
      conflictingEvidence: bundle.conflictingEvidence,
      topResults: [
        ...bundle.directFacts,
        ...bundle.supportingSections,
        ...bundle.tables,
        ...bundle.figures,
        ...bundle.warnings,
      ]
        .slice(0, limit)
        .map((item) => ({
          id: item.id,
          corpusType: item.corpusType,
          score: Number(item.score.toFixed(3)),
          title: item.title,
          excerpt: item.text.slice(0, 220),
          citation: item.citation,
        })),
    };
    ctx.retrievalCache.set(cacheKey, payload);
    return textResult(payload);
  });
}

export function handleGetManualPage(
  ctx: AgentContext,
  input: { source: string; page: number },
) {
  return timed(ctx, "get_manual_page", "retrieval", () => {
    if (ctx.pageFetchCount >= ctx.maxPageFetches) {
      return textResult({
        error: "page_fetch_budget_exhausted",
        message:
          "Page fetch budget used. Answer now from search_manual excerpts and registered artifacts — do not fetch more pages.",
        citations: ctx.citations.slice(0, 8),
      });
    }
    ctx.pageFetchCount += 1;

    const page = (
      pagesData as Array<{
        source: string;
        page: number;
        text: string;
        renderAssetPath?: string;
      }>
    ).find((p) => p.source === input.source && p.page === input.page);

    if (!page) {
      return textResult({
        error: "Page not found",
        source: input.source,
        page: input.page,
      });
    }

    const renderPath =
      page.renderAssetPath ?? getPageRenderPath(page.source, page.page);
    const truncated = page.text.length > PAGE_TEXT_LIMIT;
    const text = truncated
      ? `${page.text.slice(0, PAGE_TEXT_LIMIT)}…`
      : page.text;
    const citation: Citation = {
      source: page.source,
      page: page.page,
      excerpt: page.text.slice(0, 280),
      assetId: renderPath.replace(/^\//, ""),
    };
    addCitations(ctx, [citation]);

    return textResult({
      source: page.source,
      page: page.page,
      text,
      truncated,
      renderPath,
      citation,
    });
  });
}

export function handleGetFigure(
  ctx: AgentContext,
  input: { assetId?: string; source?: string; page?: number },
) {
  return timed(ctx, "get_figure", "retrieval", () => {
    const cacheKey = `${input.assetId ?? ""}::${input.source ?? ""}::${input.page ?? ""}`;
    const cached = ctx.figureCache.get(cacheKey);
    if (cached) {
      addToolSummary(ctx, `get_figure: cache hit for ${cacheKey}`);
      return textResult(cached);
    }

    if (input.assetId) {
      const asset = getAssetById(input.assetId);
      if (asset) {
        const citation: Citation = {
          source: asset.source,
          page: asset.page,
          excerpt: asset.caption,
          assetId: asset.id,
        };
        addCitations(ctx, [citation]);

        const figure =
          loadFigureCandidates().find((f) => f.id === input.assetId) ?? {
            id: asset.id,
            kind: "page_render",
            caption:
              asset.caption ??
              `Manual figure — ${asset.source} p.${asset.page}`,
            isDiagram: true,
            provenance: {
              source: asset.source,
              page: asset.page,
              assetPath: asset.path,
            },
            isPageFallback: asset.id.endsWith("-page"),
          };

        const validated = validateArtifactSpec(
          buildManualFigureArtifact(figure, { citations: [citation] }),
        );
        if (validated) addArtifact(ctx, validated);

        const payload = {
          assetId: asset.id,
          source: asset.source,
          page: asset.page,
          caption: asset.caption,
          path: asset.path,
          citation,
        };
        ctx.figureCache.set(cacheKey, payload);
        return textResult(payload);
      }
    }

    if (input.source && input.page) {
      const figs = (
        figuresData as Array<{
          id: string;
          caption?: string;
          provenance: { source: string; page: number };
        }>
      ).filter(
        (f) =>
          f.provenance.source === input.source &&
          f.provenance.page === input.page,
      );

      const citations = figs.map((f) => ({
        source: f.provenance.source,
        page: f.provenance.page,
        excerpt: f.caption,
        assetId: f.id,
      }));
      addCitations(ctx, citations);
      const payload = {
        figures: figs.map((f) => ({
          id: f.id,
          caption: f.caption,
          source: f.provenance.source,
          page: f.provenance.page,
        })),
        citations,
      };
      ctx.figureCache.set(cacheKey, payload);
      return textResult(payload);
    }

    return textResult({ error: "Provide assetId or source+page" });
  });
}

export function handleQueryMachineGraph(
  ctx: AgentContext,
  input: {
    queryType: "required_setup" | "faults_for_symptom" | "safety_prerequisites";
    processId?: string;
    symptom?: string;
    actionId?: string;
  },
) {
  return timed(ctx, "query_machine_graph", "retrieval", () => {
    const cacheKey = `${input.queryType}::${input.processId ?? ""}::${input.symptom ?? ""}::${input.actionId ?? ""}`;
    const cached = ctx.graphCache.get(cacheKey);
    if (cached) {
      addToolSummary(ctx, `query_machine_graph: cache hit for ${cacheKey}`);
      return textResult(cached);
    }

    const graph = getKnowledgeGraph();

    if (input.queryType === "required_setup" && input.processId) {
      const setup = getRequiredSetup(graph, input.processId);
      addToolSummary(
        ctx,
        `query_machine_graph: required_setup for ${input.processId}`,
      );
      const payload = { setup };
      ctx.graphCache.set(cacheKey, payload);
      return textResult(payload);
    }

    if (input.queryType === "faults_for_symptom" && input.symptom) {
      const symptomNode = findSymptomByName(graph, input.symptom);
      if (!symptomNode) {
        return textResult({
          error: "Symptom not found in graph",
          symptom: input.symptom,
        });
      }
      const faults = findFaultsForSymptom(graph, symptomNode.id);
      addToolSummary(
        ctx,
        `query_machine_graph: ${faults.length} faults for ${input.symptom}`,
      );
      const payload = {
        symptom: { id: symptomNode.id, name: symptomNode.name },
        faults: faults.slice(0, 6).map((f) => ({
          id: f.fault?.id,
          label: f.fault?.name ?? f.fault?.id,
          evidence: f.evidence.slice(0, 2).map((e) => ({
            source: e.provenance.source,
            page: e.provenance.page,
            excerpt: e.excerpt?.slice(0, 160),
          })),
        })),
      };
      ctx.graphCache.set(cacheKey, payload);
      return textResult(payload);
    }

    if (input.queryType === "safety_prerequisites" && input.actionId) {
      const constraints = getSafetyPrerequisites(graph, input.actionId);
      const payload = { constraints };
      ctx.graphCache.set(cacheKey, payload);
      return textResult(payload);
    }

    return textResult({ error: "Invalid graph query parameters" });
  });
}

export function handleCalculateDutyCycle(
  ctx: AgentContext,
  input: {
    process: "mig" | "tig" | "stick" | "flux";
    inputVoltage: 120 | 240;
    amps: number;
  },
) {
  return timed(ctx, "calculate_duty_cycle", "artifact", () => {
    const result = calculateDutyCycle(input);
    if (result.citation) addCitations(ctx, [result.citation]);
    addToolSummary(ctx, `calculate_duty_cycle: ${result.message}`);

    const artifact = validateArtifactSpec({
      type: "duty-cycle-calculator",
      title: `Duty Cycle — ${input.process.toUpperCase()} @ ${input.inputVoltage}V`,
      process: input.process,
      voltage: input.inputVoltage,
      defaultAmps: input.amps,
      ratedDutyPercent: result.applicableDutyPercent ?? undefined,
      ratedAmps: result.applicableRatedAmps ?? undefined,
      continuousAmps: result.continuousEntry?.amps,
      citations: result.citation ? [result.citation] : [],
      confidence: result.ratedEntry ? "high" : "low",
    });
    if (artifact) addArtifact(ctx, artifact);

    return textResult({
      ...result,
      artifactAttached: Boolean(artifact),
      note: artifact
        ? "Duty-cycle calculator artifact already registered — do not call generate_artifact_spec."
        : undefined,
    });
  });
}

export function handleValidateMachineConfiguration(
  ctx: AgentContext,
  input: {
    process: "mig" | "flux" | "tig" | "stick";
    polarityConfigId?: string;
    inputVoltage?: 120 | 240;
    consumableIds?: string[];
  },
) {
  return timed(ctx, "validate_machine_configuration", "other", () => {
    const graph = getKnowledgeGraph();
    const processId =
      INGEST_PROCESS_MAP[input.process] ?? `process-${input.process}`;
    const validation = validateConfiguration(graph, {
      id: `config-${processId}`,
      processId,
      polarityConfigId: input.polarityConfigId,
      inputVoltage: input.inputVoltage,
      consumableIds: input.consumableIds ?? [],
      componentIds: [],
    });
    const required = getRequiredSetup(graph, processId);
    addToolSummary(
      ctx,
      `validate_machine_configuration: valid=${validation.valid}`,
    );
    return textResult({ validation, required });
  });
}

export function handleFindSettings(
  ctx: AgentContext,
  input: SettingsLookupInput,
) {
  return timed(ctx, "find_settings", "artifact", () => {
    const cacheKey = JSON.stringify({
      query: input.query ?? "",
      process: input.process ?? "",
      material: input.material ?? "",
      thickness: input.thickness ?? "",
      inputVoltage: input.inputVoltage ?? "",
      wireType: input.wireType ?? "",
      wireDiameter: input.wireDiameter ?? "",
      shieldingGas: input.shieldingGas ?? "",
    });
    const cached = ctx.settingsCache.get(cacheKey);
    if (cached) {
      addToolSummary(ctx, "find_settings: cache hit for identical parameters");
      return textResult(cached);
    }

    const resolution = resolveSettings(input);
    addCitations(ctx, resolution.citations);
    addToolSummary(
      ctx,
      `find_settings: status=${resolution.recommendationStatus} process=${resolution.process ?? "?"}`,
    );

    const artifact = buildSettingsConfiguratorArtifact(resolution);
    if (artifact) addArtifact(ctx, artifact);

    const payload = {
      recommendationStatus: resolution.recommendationStatus,
      naturalLanguageAnswer: resolution.naturalLanguageAnswer,
      process: resolution.process,
      clarifyingQuestion: resolution.clarifyingQuestion,
      missingRequiredParameters: resolution.missingRequiredParameters,
      ambiguities: resolution.missingRequiredParameters.map((p) => ({
        kind: "missing_parameter",
        message: `Missing ${p}`,
      })),
      settingsItems: resolution.sourceRecords
        .filter((r) => r.recordType === "selection_chart")
        .slice(0, 4)
        .map((r) => ({
          id: r.id,
          source: r.source,
          page: r.page,
          section: r.section,
          excerpt: r.excerpt?.slice(0, 200),
          recordType: r.recordType,
        })),
      citations: resolution.citations.slice(0, 6),
      polarity: resolution.polarity,
      voltageSetting: resolution.voltageSetting,
      wireFeedSetting: resolution.wireFeedSetting,
      artifactAttached: Boolean(artifact),
      note: artifact
        ? "Settings configurator artifact already registered — do not call generate_artifact_spec."
        : resolution.recommendationStatus === "multimodal_required"
          ? "Selection chart is image-only; do not invent voltage/WFS numbers."
          : undefined,
    };
    ctx.settingsCache.set(cacheKey, payload);
    return textResult(payload);
  });
}

export function handleStartDiagnosticSession(
  ctx: AgentContext,
  input: {
    sessionId?: string;
    symptoms?: string[];
    primarySymptom?: string;
  },
) {
  return timed(ctx, "start_diagnostic_session", "other", () => {
    const session = startDiagnosticSession(input);
    addToolSummary(ctx, `start_diagnostic_session: ${session.id}`);
    return textResult({ diagnosticState: sessionToDiagnosticState(session) });
  });
}

export function handleUpdateDiagnosticSession(
  ctx: AgentContext,
  input: {
    sessionId: string;
    newSymptoms?: string[];
    ruledOutHypothesisIds?: string[];
    answeredQuestion?: string;
    evidenceSummary?: string;
    questionRationale?: string;
  },
) {
  return timed(ctx, "update_diagnostic_session", "other", () => {
    const session = updateDiagnosticSession(input);
    if (!session) {
      return textResult({ error: "Session not found", sessionId: input.sessionId });
    }
    addToolSummary(ctx, `update_diagnostic_session: ${session.id}`);
    return textResult({ diagnosticState: sessionToDiagnosticState(session) });
  });
}

export function handleGenerateArtifactSpec(
  ctx: AgentContext,
  input: { spec: unknown },
) {
  return timed(ctx, "generate_artifact_spec", "artifact", () => {
    if (ctx.artifacts.length > 0) {
      const existing = ctx.artifacts[ctx.artifacts.length - 1]!;
      return textResult({
        ok: true,
        reusedExisting: true,
        spec: existing,
        note: "An artifact is already registered from a prior tool — reuse it in the final JSON.",
      });
    }
    const validated = validateArtifactSpec(input.spec);
    if (!validated) {
      return textResult({
        error: "Invalid artifact spec",
        hint: "Use type (not kind): polarity-diagram | duty-cycle-calculator | settings-configurator | manual-figure | annotated-manual-figure | component-map. Include required fields (caption/source/page/assetId for figures; groundSocket/electrodeSocket for polarity).",
      });
    }
    addArtifact(ctx, validated);
    addToolSummary(ctx, `generate_artifact_spec: ${validated.type}`);
    return textResult({ ok: true, spec: validated });
  });
}

export function handleRunSafetyReview(
  ctx: AgentContext,
  input: {
    mentionsArc?: boolean;
    mentionsPower?: boolean;
    safetyAcknowledged?: boolean;
    proceduralAction?: string;
  },
) {
  return timed(ctx, "run_safety_review", "safety", () => {
    const action = input.proceduralAction ?? "";
    const result = validateSafetyContext({
      mentionsArc: input.mentionsArc ?? true,
      mentionsPower:
        input.mentionsPower ?? /power|energized|pcb|interior/i.test(action),
      mentionsBypassInterlock: /\bbypass\b.*\binterlock\b/i.test(action),
      safetyAcknowledged: input.safetyAcknowledged,
    });

    const notices = [...result.warnings, ...result.blockers];
    addToolSummary(ctx, `run_safety_review: passed=${result.passed}`);

    return textResult({
      passed: result.passed,
      safetyNotices: notices,
      recommendation: result.passed
        ? "Proceed with stated precautions in safetyNotices."
        : "Do not recommend the action until blockers are resolved.",
    });
  });
}

export function getSessionDiagnosticState(sessionId: string) {
  const session = getDiagnosticSession(sessionId);
  return session ? sessionToDiagnosticState(session) : null;
}
