import pagesData from "@/data/generated/pages.json";
import sectionsData from "@/data/generated/sections.json";
import tablesData from "@/data/generated/tables.json";
import entitiesData from "@/data/generated/entities.json";
import figuresData from "@/data/generated/figures.json";
import warningsData from "@/data/generated/warnings.json";
import {
  buildSearchText,
  getNormalizedTroubleshootingRecords,
} from "@/lib/troubleshooting";
import type { NormalizedTroubleshootingRecord } from "@/lib/troubleshooting";
import polarityData from "@/data/generated/polarity.json";
import settingsData from "@/data/generated/settings.json";
import dutyCycleData from "@/data/generated/duty-cycle.json";
import knowledgeGraphData from "@/data/generated/knowledge-graph.json";
import type { CorpusDocument, CorpusType, RetrievalMetadata } from "@/lib/retrieval/types";
import { resetTroubleshootingRecordsCache } from "@/lib/troubleshooting/normalize";
import { QUERY_PAGE_HINTS, pageAssetId } from "@/lib/visual/figures";
import { assetIdFromSource } from "@/lib/retrieval/citations";
import { buildBM25Index, type BM25Index } from "@/lib/retrieval/bm25";

interface IngestProvenance {
  source: string;
  page: number;
  section?: string;
  confidence: number;
  assetPath?: string;
  neighboringText?: string;
}

function meta(
  provenance: IngestProvenance,
  extra: Partial<RetrievalMetadata> = {},
): RetrievalMetadata {
  const verified = extra.verified ?? (provenance.confidence >= 0.75);
  return {
    source: provenance.source,
    page: provenance.page,
    section: provenance.section ?? extra.section,
    processes: extra.processes ?? [],
    inputVoltage: extra.inputVoltage,
    outputAmps: extra.outputAmps,
    material: extra.material,
    symptom: extra.symptom,
    component: extra.component,
    polarity: extra.polarity,
    safetyRelevant: extra.safetyRelevant,
    verified,
    assetPath: provenance.assetPath ?? extra.assetPath,
    assetId: extra.assetId ?? assetIdFromSource(provenance.source, provenance.page),
  };
}

function inferProcesses(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  if (/\bmig\b|solid core|gas shielded/i.test(lower)) found.push("mig");
  if (/flux[- ]?core|gasless/i.test(lower)) found.push("flux");
  if (/\btig\b/i.test(lower)) found.push("tig");
  if (/\bstick\b/i.test(lower)) found.push("stick");
  return found;
}

function buildPageDocuments(): CorpusDocument[] {
  return (pagesData as Array<{ id: string; source: string; page: number; text: string; renderAssetPath?: string }>)
    .filter((p) => p.text && p.text.length > 30)
    .map((p) => ({
      id: p.id,
      corpusType: "text_section" as CorpusType,
      title: `Page ${p.page}`,
      text: p.text,
      metadata: meta(
        { source: p.source, page: p.page, confidence: 0.9 },
        { processes: inferProcesses(p.text), assetPath: p.renderAssetPath },
      ),
      payload: p,
    }));
}

function buildSectionDocuments(): CorpusDocument[] {
  return (sectionsData as Array<{ id: string; title: string; provenance: IngestProvenance }>)
    .filter((s) => s.title.length > 4 && s.title.length < 100)
    .map((s) => ({
      id: s.id,
      corpusType: "text_section" as CorpusType,
      title: s.title,
      text: `${s.title} ${s.provenance.neighboringText ?? ""}`,
      metadata: meta(s.provenance, { processes: inferProcesses(s.title) }),
      payload: s,
    }));
}

function buildTableDocuments(): CorpusDocument[] {
  return (tablesData as Array<{
    id: string;
    headers: string[];
    rows: string[][];
    category?: string;
    provenance: IngestProvenance;
    needsReview?: boolean;
  }>)
    .filter((t) => t.rows.length > 0 || t.headers.some((h) => h.length > 0))
    .map((t) => {
      const text = [
        t.category ?? "table",
        ...t.headers,
        ...t.rows.flat(),
      ].join(" ");
      return {
        id: t.id,
        corpusType: "table" as CorpusType,
        title: t.category ?? "Table",
        text,
        metadata: meta(t.provenance, {
          verified: !t.needsReview && t.provenance.confidence >= 0.7,
          processes: inferProcesses(text),
        }),
        payload: t,
      };
    });
}

function buildFigureDocuments(): CorpusDocument[] {
  const entities = entitiesData as Array<{
    label: string;
    text: string;
    provenance: { source: string; page: number; section?: string };
  }>;

  return (figuresData as Array<{
    id: string;
    kind: string;
    caption?: string;
    provenance: IngestProvenance;
    isDiagram?: boolean;
  }>).map((f) => {
    const pageEntities = entities.filter(
      (e) =>
        e.provenance.source === f.provenance.source &&
        e.provenance.page === f.provenance.page,
    );
    const entityText = pageEntities.map((e) => `${e.label} ${e.text}`).join(" ");
    const section = f.provenance.section ?? pageEntities[0]?.provenance.section;

    return {
      id: f.id,
      corpusType: "figure" as CorpusType,
      title: f.caption ?? f.kind,
      text: [
        f.caption ?? "",
        f.kind,
        f.provenance.neighboringText ?? "",
        f.provenance.section ?? "",
        entityText,
        f.provenance.source.replace(".pdf", ""),
      ].join(" "),
      metadata: meta(f.provenance, {
        section,
        component: /panel|socket|polarity|control|mechanism|feed/i.test(
          `${f.caption} ${entityText}`,
        )
          ? "front panel"
          : undefined,
        processes: inferProcesses(`${f.caption ?? ""} ${entityText}`),
        assetId: f.id,
        assetPath: f.provenance.assetPath,
      }),
      payload: f,
    };
  });
}

function buildPageRenderFigureDocuments(): CorpusDocument[] {
  const hintedPages = new Set(
    QUERY_PAGE_HINTS.map((h) => `${h.source}:${h.page}`),
  );

  return (
    pagesData as Array<{
      id: string;
      source: string;
      page: number;
      text: string;
      renderAssetPath?: string;
    }>
  )
    .filter(
      (p) =>
        p.renderAssetPath &&
        hintedPages.has(`${p.source}:${p.page}`) &&
        p.source !== "selection-chart.pdf",
    )
    .map((p) => {
      const hint = QUERY_PAGE_HINTS.find(
        (h) => h.source === p.source && h.page === p.page,
      );
      const sectionMatch = p.text.match(
        /Front Panel Controls|Interior Controls|Wire Feed Mechanism|Wire Weld|TIG Setup|DCEP|Porosity|Spatter/i,
      );
      const title = sectionMatch
        ? `${sectionMatch[0]} — manual diagram`
        : hint?.label ?? `Manual page ${p.page} diagram`;

      return {
        id: `${p.id}-visual`,
        corpusType: "figure" as CorpusType,
        title,
        text: `${title} ${hint?.label ?? ""} manual diagram figure illustration visual chart`.trim(),
        metadata: meta(
          {
            source: p.source,
            page: p.page,
            confidence: 0.92,
            assetPath: p.renderAssetPath,
            section: sectionMatch?.[0],
          },
          {
            assetId: pageAssetId(p.source, p.page),
            assetPath: p.renderAssetPath,
            processes: inferProcesses(`${title} ${hint?.label ?? ""}`),
          },
        ),
        payload: p,
      };
    });
}

function buildWarningDocuments(): CorpusDocument[] {
  const seen = new Set<string>();
  return (warningsData as Array<{ id: string; level: string; text: string; provenance: IngestProvenance }>)
    .filter((w) => {
      if (seen.has(w.text)) return false;
      seen.add(w.text);
      return w.text.length > 10;
    })
    .map((w) => ({
      id: w.id,
      corpusType: "warning" as CorpusType,
      title: `${w.level.toUpperCase()}: ${w.text.slice(0, 60)}`,
      text: w.text,
      metadata: meta(w.provenance, { safetyRelevant: true, verified: true }),
      payload: w,
    }));
}

function buildTroubleshootingDocuments(): CorpusDocument[] {
  return getNormalizedTroubleshootingRecords().map((record) => {
    const primary = record.sourceEvidence[0];
    const text = buildSearchText(record);
    const canonicalSymptoms = record.aliases
      .map((a) => a.toLowerCase())
      .filter((a) => a.length > 3);

    return {
      id: record.id,
      corpusType: "troubleshooting" as CorpusType,
      title: record.symptom,
      text,
      metadata: meta(
        {
          source: primary?.source ?? "owner-manual.pdf",
          page: primary?.page ?? 0,
          section: primary?.section,
          confidence: 0.88,
          neighboringText: record.symptom,
        },
        {
          processes: record.process.length ? record.process : inferProcesses(text),
          symptom: canonicalSymptoms[0] ?? record.symptom.toLowerCase(),
          component: /wire feed|liner|drive roll|feed roller|tension/i.test(text)
            ? "wire feed"
            : /contact tip/i.test(text)
              ? "contact tip"
              : undefined,
          verified: true,
          assetId: record.visualEvidence[0]?.assetId,
          assetPath: record.visualEvidence[0]?.assetId
            ? undefined
            : primary?.assetId,
        },
      ),
      payload: record as NormalizedTroubleshootingRecord,
    };
  });
}

function buildPolarityDocuments(): CorpusDocument[] {
  return (polarityData as Array<{
    id: string;
    polarityType: string | null;
    process: string | null;
    groundSocket: string | null;
    electrodeSocket: string | null;
    instructions?: string;
    needsReview?: boolean;
    provenance: IngestProvenance;
  }>)
    .filter((p) => p.instructions && p.instructions.length > 20)
    .map((p) => ({
      id: p.id,
      corpusType: "polarity" as CorpusType,
      title: `${p.polarityType ?? "Polarity"} ${p.process ?? ""}`.trim(),
      text: p.instructions ?? "",
      metadata: meta(p.provenance, {
        processes: p.process ? [p.process === "mig-solid" ? "mig" : p.process] : inferProcesses(p.instructions ?? ""),
        polarity: p.polarityType ?? undefined,
        component: "ground clamp",
        verified: !p.needsReview && !!(p.polarityType && (p.groundSocket || p.electrodeSocket)),
      }),
      payload: p,
    }));
}

function buildSettingsDocuments(): CorpusDocument[] {
  return (settingsData as Array<{
    id: string;
    type?: string;
    needsMultimodalInterpretation?: boolean;
    provenance: IngestProvenance;
  }>).map((s) => ({
    id: s.id,
    corpusType: "settings" as CorpusType,
    title: s.type ?? "Settings",
    text: `settings ${s.type ?? ""} selection chart process material thickness voltage wire speed`,
    metadata: meta(s.provenance, {
      verified: false,
      processes: ["mig", "flux", "tig", "stick"],
    }),
    payload: s,
  }));
}

function buildDutyCycleDocuments(): CorpusDocument[] {
  return (dutyCycleData as Array<{
    id: string;
    process: string | null;
    inputVoltage: number | null;
    dutyPercent: number;
    amps: number;
    continuous?: boolean;
    needsReview?: boolean;
    provenance: IngestProvenance;
  }>).map((d) => {
    const process = d.process ?? "unknown";
    const voltage = d.inputVoltage ?? 0;
    const text = `${process} ${voltage}VAC ${d.dutyPercent}% duty cycle at ${d.amps}A${d.continuous ? " continuous" : ""}`;
    return {
      id: d.id,
      corpusType: "duty_cycle" as CorpusType,
      title: text,
      text,
      metadata: meta(d.provenance, {
        processes: d.process ? [d.process] : [],
        inputVoltage: (d.inputVoltage === 120 || d.inputVoltage === 240)
          ? d.inputVoltage
          : undefined,
        outputAmps: d.amps,
        verified: !d.needsReview && !!(d.process && d.inputVoltage),
      }),
      payload: d,
    };
  });
}

function buildGraphRelationshipDocuments(): CorpusDocument[] {
  const kg = knowledgeGraphData as {
    relationships: Array<{
      id: string;
      type: string;
      fromId: string;
      toId: string;
      verificationStatus: string;
      confidence: number;
      evidenceIds?: string[];
      metadata?: Record<string, unknown>;
    }>;
    nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
    evidence: Array<{ id: string; provenance: IngestProvenance; excerpt?: string }>;
  };

  const nodeMap = new Map(kg.nodes.map((n) => [n.id, n]));
  const evidenceMap = new Map(kg.evidence.map((e) => [e.id, e]));

  return kg.relationships.map((rel) => {
    const fromNode = nodeMap.get(rel.fromId);
    const toNode = nodeMap.get(rel.toId);
    const fromLabel = (fromNode?.data.name as string) ?? (fromNode?.data.label as string) ?? rel.fromId;
    const toLabel = (toNode?.data.name as string) ?? (toNode?.data.label as string) ?? rel.toId;
    const text = `${rel.type}: ${fromLabel} → ${toLabel}`;
    const evidence = rel.evidenceIds?.[0] ? evidenceMap.get(rel.evidenceIds[0]) : undefined;
    const prov = evidence?.provenance ?? {
      source: "owner-manual.pdf",
      page: 0,
      confidence: rel.confidence,
    };

    return {
      id: rel.id,
      corpusType: "graph_relationship" as CorpusType,
      title: rel.type,
      text,
      metadata: meta(prov, {
        verified: rel.verificationStatus === "verified",
        processes: inferProcesses(text),
        symptom: /porosity/i.test(text) ? "porosity" : undefined,
      }),
      payload: rel,
    };
  });
}

let cachedIndex: BM25Index | null = null;
let cachedDocuments: CorpusDocument[] | null = null;

export function buildCorpus(): CorpusDocument[] {
  if (cachedDocuments) return cachedDocuments;

  const docs: CorpusDocument[] = [
    ...buildPageDocuments(),
    ...buildSectionDocuments(),
    ...buildTableDocuments(),
    ...buildFigureDocuments(),
    ...buildPageRenderFigureDocuments(),
    ...buildWarningDocuments(),
    ...buildTroubleshootingDocuments(),
    ...buildPolarityDocuments(),
    ...buildSettingsDocuments(),
    ...buildDutyCycleDocuments(),
    ...buildGraphRelationshipDocuments(),
  ];

  cachedDocuments = docs;
  return docs;
}

export function getRetrievalIndex(): BM25Index {
  if (!cachedIndex) {
    cachedIndex = buildBM25Index(buildCorpus());
  }
  return cachedIndex;
}

export function resetRetrievalIndex(): void {
  cachedIndex = null;
  cachedDocuments = null;
  resetTroubleshootingRecordsCache();
}

export function getCorpusStats() {
  const docs = buildCorpus();
  const byType = new Map<CorpusType, number>();
  for (const d of docs) {
    byType.set(d.corpusType, (byType.get(d.corpusType) ?? 0) + 1);
  }
  return {
    total: docs.length,
    byType: Object.fromEntries(byType),
  };
}
