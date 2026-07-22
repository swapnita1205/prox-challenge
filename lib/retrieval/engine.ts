import { applyMetadataBoost, searchBM25 } from "@/lib/retrieval/bm25";
import { getRetrievalIndex } from "@/lib/retrieval/corpus";
import {
  citationFromDocument,
  supplementaryCitationsFromItem,
} from "@/lib/retrieval/citations";
import { decomposeQuery } from "@/lib/retrieval/decompose";
import { extractQueryDimensions } from "@/lib/retrieval/dimensions";
import type {
  Ambiguity,
  ConflictingEvidence,
  CorpusDocument,
  CorpusType,
  FormattedCitation,
  QueryDimensions,
  RetrievalBundle,
  RetrievedItem,
  RetrievalTask,
} from "@/lib/retrieval/types";
import { normalizeQuery, tokenize } from "@/lib/retrieval/tokenizer";

export interface RetrieveOptions {
  limitPerTask?: number;
  minScore?: number;
}

function keywordScore(query: string, doc: CorpusDocument): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const haystack = normalizeQuery(doc.text);
  let hits = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) hits += 1;
  }
  return hits / tokens.length;
}

function hybridScore(bm25: number, keyword: number): number {
  const normalizedBm25 = bm25 / (bm25 + 3);
  return normalizedBm25 * 0.65 + keyword * 0.35;
}

function matchesMetadataFilter(
  doc: CorpusDocument,
  dims?: Partial<QueryDimensions>,
): boolean {
  if (!dims) return true;
  const m = doc.metadata;

  if (dims.processes?.length) {
    const docProcesses = m.processes;
    if (docProcesses.length > 0 && !dims.processes.some((p) => docProcesses.includes(p))) {
      return false;
    }
  }

  if (dims.inputVoltage && m.inputVoltage && m.inputVoltage !== dims.inputVoltage) {
    return false;
  }

  if (dims.outputAmps && m.outputAmps && Math.abs(m.outputAmps - dims.outputAmps) > 5) {
    return false;
  }

  return true;
}

function docToItem(doc: CorpusDocument, score: number): RetrievedItem {
  const excerptLimit = doc.corpusType === "troubleshooting" ? 1200 : 500;
  return {
    id: doc.id,
    corpusType: doc.corpusType,
    score,
    title: doc.title,
    text: doc.text.slice(0, excerptLimit),
    metadata: doc.metadata,
    citation: citationFromDocument(doc),
    payload: doc.payload,
  };
}

function executeTask(
  task: RetrievalTask,
  options: RetrieveOptions,
): RetrievedItem[] {
  const index = getRetrievalIndex();
  const limit = options.limitPerTask ?? 8;
  const minScore = options.minScore ?? 0.05;

  const bm25Results = searchBM25(index, task.expandedQuery, {
    limit: limit * 3,
    minScore: 0.001,
    filter: (doc) => {
      if (task.corpusTypes && !task.corpusTypes.includes(doc.corpusType)) return false;
      return matchesMetadataFilter(doc, task.dimensions);
    },
  });

  const scored: RetrievedItem[] = [];

  for (const { doc, score: bm25 } of bm25Results) {
    const kw = keywordScore(task.expandedQuery, doc);
    let score = hybridScore(bm25, kw);

    score = applyMetadataBoost(score, doc, {
      processes: task.dimensions?.processes,
      inputVoltage: task.dimensions?.inputVoltage,
      outputAmps: task.dimensions?.outputAmps,
      component: task.dimensions?.component,
      symptom: task.dimensions?.symptom,
      safetyRelevant: task.dimensions?.safetyRelevant,
      verifiedOnly: false,
    });

    if (score >= minScore) {
      scored.push(docToItem(doc, score));
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function mergeItems(items: RetrievedItem[]): RetrievedItem[] {
  const byId = new Map<string, RetrievedItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || item.score > existing.score) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function isDirectFact(item: RetrievedItem): boolean {
  if (item.corpusType === "duty_cycle") return true;
  if (item.corpusType === "polarity" && item.metadata.verified) return true;
  if (item.corpusType === "settings") return true;
  if (item.corpusType === "troubleshooting" && item.metadata.verified) return true;
  return false;
}

function bucketItems(items: RetrievedItem[]): Pick<
  RetrievalBundle,
  "directFacts" | "supportingSections" | "tables" | "figures" | "warnings" | "graphRelationships"
> {
  const directFacts: RetrievedItem[] = [];
  const supportingSections: RetrievedItem[] = [];
  const tables: RetrievedItem[] = [];
  const figures: RetrievedItem[] = [];
  const warnings: RetrievedItem[] = [];
  const graphRelationships: RetrievedItem[] = [];

  for (const item of items) {
    if (isDirectFact(item)) {
      directFacts.push(item);
      continue;
    }

    switch (item.corpusType) {
      case "table":
        tables.push(item);
        break;
      case "figure":
        figures.push(item);
        break;
      case "warning":
        warnings.push(item);
        break;
      case "graph_relationship":
        graphRelationships.push(item);
        break;
      case "text_section":
      case "troubleshooting":
      case "polarity":
        supportingSections.push(item);
        break;
      default:
        supportingSections.push(item);
    }
  }

  return {
    directFacts: directFacts.slice(0, 12),
    supportingSections: supportingSections.slice(0, 15),
    tables: tables.slice(0, 8),
    figures: figures.slice(0, 8),
    warnings: warnings.slice(0, 8),
    graphRelationships: graphRelationships.slice(0, 10),
  };
}

function detectAmbiguities(query: string, dimensions: QueryDimensions): Ambiguity[] {
  const ambiguities: Ambiguity[] = [];

  if (dimensions.processes.length === 0 && /weld|setting|polarity|porosity|feed/i.test(query)) {
    ambiguities.push({
      kind: "missing_process",
      message: "Query does not specify welding process (MIG, flux-core, TIG, or stick).",
      suggestions: ["Specify MIG solid core", "Specify flux-cored", "Specify TIG", "Specify stick"],
    });
  }

  if (dimensions.processes.length > 1) {
    ambiguities.push({
      kind: "multiple_processes",
      message: `Multiple processes detected: ${dimensions.processes.join(", ")}.`,
      suggestions: ["Clarify which process you are using"],
    });
  }

  if (
    dimensions.intents.includes("duty_cycle") &&
    !dimensions.inputVoltage &&
    dimensions.outputAmps
  ) {
    ambiguities.push({
      kind: "missing_voltage",
      message: "Duty cycle depends on input voltage (120V or 240V) but voltage was not specified.",
      suggestions: ["Specify 120VAC or 240VAC"],
    });
  }

  if (/wrong|problem|issue|bad|not working/i.test(query) && !dimensions.symptom && dimensions.processes.length === 0) {
    ambiguities.push({
      kind: "ambiguous_symptom",
      message: "Symptom or defect is unclear; troubleshooting evidence may span multiple processes.",
      suggestions: ["Describe the defect (porosity, spatter, wire feed, etc.)"],
    });
  }

  if (dimensions.intents.includes("settings") || /setting|chart|recommend/i.test(query)) {
    ambiguities.push({
      kind: "multimodal_required",
      message: "Settings chart is image-only; numeric recommendations require multimodal interpretation.",
      suggestions: ["Upload a photo of the selection chart", "Specify material, thickness, and process"],
    });
  }

  return ambiguities;
}

function detectConflicts(items: RetrievedItem[]): ConflictingEvidence[] {
  const conflicts: ConflictingEvidence[] = [];

  const polarityByProcess = new Map<string, RetrievedItem[]>();
  for (const item of items) {
    if (item.corpusType !== "polarity" || !item.metadata.verified) continue;
    for (const p of item.metadata.processes) {
      const list = polarityByProcess.get(p) ?? [];
      list.push(item);
      polarityByProcess.set(p, list);
    }
  }

  for (const [process, polarities] of polarityByProcess) {
    const types = new Set(
      polarities.map((p) => p.metadata.polarity).filter(Boolean),
    );
    if (types.size > 1) {
      conflicts.push({
        topic: `${process} polarity`,
        items: polarities.map((p) => p.citation),
        message: `Conflicting polarity guidance found for ${process}: ${[...types].join(" vs ")}.`,
      });
    }
  }

  const dutyByKey = new Map<string, RetrievedItem[]>();
  for (const item of items) {
    if (item.corpusType !== "duty_cycle") continue;
    const key = `${item.metadata.processes.join(",")}-${item.metadata.inputVoltage}-${item.metadata.outputAmps}`;
    const list = dutyByKey.get(key) ?? [];
    list.push(item);
    dutyByKey.set(key, list);
  }

  for (const [key, records] of dutyByKey) {
    const percents = new Set(
      records.map((r) => (r.payload as { dutyPercent?: number })?.dutyPercent),
    );
    if (percents.size > 1) {
      conflicts.push({
        topic: `duty cycle ${key}`,
        items: records.map((r) => r.citation),
        message: `Conflicting duty cycle percentages for ${key}.`,
      });
    }
  }

  return conflicts;
}

function collectCitations(bundle: Omit<RetrievalBundle, "citations">): FormattedCitation[] {
  const all = [
    ...bundle.directFacts,
    ...bundle.supportingSections,
    ...bundle.tables,
    ...bundle.figures,
    ...bundle.warnings,
    ...bundle.graphRelationships,
  ];
  const seen = new Set<string>();
  const citations: FormattedCitation[] = [];
  for (const item of all) {
    if (!seen.has(item.citation.id)) {
      seen.add(item.citation.id);
      citations.push(item.citation);
    }
    for (const supp of supplementaryCitationsFromItem(item)) {
      if (seen.has(supp.id)) continue;
      seen.add(supp.id);
      citations.push(supp);
    }
  }
  return citations;
}

export function retrieve(query: string, options: RetrieveOptions = {}): RetrievalBundle {
  const dimensions = extractQueryDimensions(query);
  const decomposedTasks = decomposeQuery(query, dimensions);

  const allItems: RetrievedItem[] = [];
  for (const task of decomposedTasks) {
    allItems.push(...executeTask(task, options));
  }

  const merged = mergeItems(allItems);
  const buckets = bucketItems(merged);
  const ambiguities = detectAmbiguities(query, dimensions);
  const conflictingEvidence = detectConflicts(merged);

  const partial: Omit<RetrievalBundle, "citations"> = {
    query,
    decomposedTasks,
    dimensions,
    ...buckets,
    ambiguities,
    conflictingEvidence,
  };

  return {
    ...partial,
    citations: collectCitations(partial),
  };
}

export function getAllRetrievedItems(bundle: RetrievalBundle): RetrievedItem[] {
  return [
    ...bundle.directFacts,
    ...bundle.supportingSections,
    ...bundle.tables,
    ...bundle.figures,
    ...bundle.warnings,
    ...bundle.graphRelationships,
  ];
}

export function hasEvidenceMatching(
  bundle: RetrievalBundle,
  predicate: (item: RetrievedItem) => boolean,
): boolean {
  return getAllRetrievedItems(bundle).some(predicate);
}

export function hasCitationOnPage(bundle: RetrievalBundle, page: number, source = "owner-manual.pdf"): boolean {
  return bundle.citations.some((c) => c.page === page && c.source === source);
}

export function findItemsByCorpusType(
  bundle: RetrievalBundle,
  corpusType: CorpusType,
): RetrievedItem[] {
  return getAllRetrievedItems(bundle).filter((i) => i.corpusType === corpusType);
}
