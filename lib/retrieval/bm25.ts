import { tokenize } from "@/lib/retrieval/tokenizer";
import type { CorpusDocument } from "@/lib/retrieval/types";

const K1 = 1.5;
const B = 0.75;

export interface BM25Index {
  documents: CorpusDocument[];
  docLengths: number[];
  avgDocLength: number;
  docFreq: Map<string, number>;
  N: number;
}

export function buildBM25Index(documents: CorpusDocument[]): BM25Index {
  const docLengths = documents.map((d) => tokenize(d.text).length);
  const avgDocLength =
    docLengths.length > 0
      ? docLengths.reduce((a, b) => a + b, 0) / docLengths.length
      : 0;

  const docFreq = new Map<string, number>();
  for (const doc of documents) {
    const seen = new Set(tokenize(doc.text));
    for (const term of seen) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  return {
    documents,
    docLengths,
    avgDocLength,
    docFreq,
    N: documents.length,
  };
}

function idf(index: BM25Index, term: string): number {
  const df = index.docFreq.get(term) ?? 0;
  return Math.log(1 + (index.N - df + 0.5) / (df + 0.5));
}

export function scoreBM25(
  index: BM25Index,
  query: string,
  docIndex: number,
): number {
  const docTokens = tokenize(index.documents[docIndex]!.text);
  const docLen = index.docLengths[docIndex]!;
  const queryTerms = tokenize(query);

  const tf = new Map<string, number>();
  for (const t of docTokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }

  let score = 0;
  for (const term of queryTerms) {
    const freq = tf.get(term) ?? 0;
    if (freq === 0) continue;
    const termIdf = idf(index, term);
    const numerator = freq * (K1 + 1);
    const denominator = freq + K1 * (1 - B + (B * docLen) / (index.avgDocLength || 1));
    score += termIdf * (numerator / denominator);
  }

  return score;
}

export function searchBM25(
  index: BM25Index,
  query: string,
  options?: {
    limit?: number;
    minScore?: number;
    filter?: (doc: CorpusDocument, index: number) => boolean;
  },
): Array<{ doc: CorpusDocument; score: number; index: number }> {
  const limit = options?.limit ?? 10;
  const minScore = options?.minScore ?? 0.01;

  const results: Array<{ doc: CorpusDocument; score: number; index: number }> = [];

  for (let i = 0; i < index.documents.length; i++) {
    if (options?.filter && !options.filter(index.documents[i]!, i)) continue;
    const score = scoreBM25(index, query, i);
    if (score >= minScore) {
      results.push({ doc: index.documents[i]!, score, index: i });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function applyMetadataBoost(
  baseScore: number,
  doc: CorpusDocument,
  filters: {
    processes?: string[];
    inputVoltage?: number;
    outputAmps?: number;
    component?: string;
    symptom?: string;
    safetyRelevant?: boolean;
    verifiedOnly?: boolean;
  },
): number {
  let score = baseScore;
  const m = doc.metadata;

  if (filters.verifiedOnly && !m.verified) {
    score *= 0.5;
  } else if (m.verified) {
    score *= 1.15;
  }

  if (filters.processes?.length) {
    const overlap = filters.processes.some((p) => m.processes.includes(p));
    if (overlap) score *= 1.25;
    else if (m.processes.length > 0) score *= 0.7;
  }

  if (filters.inputVoltage && m.inputVoltage === filters.inputVoltage) score *= 1.2;
  if (filters.outputAmps && m.outputAmps === filters.outputAmps) score *= 1.3;

  if (filters.component && doc.text.toLowerCase().includes(filters.component.toLowerCase())) {
    score *= 1.2;
  }

  if (filters.symptom && doc.text.toLowerCase().includes(filters.symptom.toLowerCase())) {
    score *= 1.2;
  }

  if (filters.safetyRelevant && m.safetyRelevant) score *= 1.15;

  if (doc.corpusType === "troubleshooting") {
    score *= 1.35;
  }

  if (doc.corpusType === "settings") {
    score *= 1.45;
  }

  if (filters.symptom && doc.metadata.symptom) {
    const symptomHaystack = `${doc.metadata.symptom} ${doc.text}`.toLowerCase();
    if (symptomHaystack.includes(filters.symptom.toLowerCase())) score *= 1.25;
  }

  return score;
}
