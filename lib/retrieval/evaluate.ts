import { retrieve, getAllRetrievedItems } from "@/lib/retrieval/engine";
import { getCorpusStats } from "@/lib/retrieval/corpus";
import type { RetrievalBundle } from "@/lib/retrieval/types";

export interface EvaluationCase {
  id: string;
  query: string;
  description: string;
  expectations: {
    minItems?: number;
    corpusTypes?: string[];
    sourcePages?: Array<{ page: number; source?: string }>;
    textPatterns?: RegExp[];
    itemIds?: string[];
    minAmbiguities?: number;
    ambiguityKinds?: string[];
  };
}

export const EVALUATION_CASES: EvaluationCase[] = [
  {
    id: "mig-duty-200a-240v",
    query: "What is the MIG duty cycle at 200 amps on 240V?",
    description: "MIG duty cycle at 200A and 240VAC",
    expectations: {
      corpusTypes: ["duty_cycle"],
      sourcePages: [{ page: 7 }],
      textPatterns: [/mig/i, /240/, /200/, /25/],
      itemIds: ["owner-manual-p07-duty-2f6d5a479400"],
    },
  },
  {
    id: "tig-polarity-ground-clamp",
    query: "What polarity setup do I need for TIG, and where does the ground clamp go?",
    description: "TIG polarity and work-clamp socket placement",
    expectations: {
      minItems: 3,
      sourcePages: [{ page: 24 }],
      textPatterns: [/tig/i, /positive/i, /ground clamp/i],
    },
  },
  {
    id: "flux-porosity",
    query: "I'm getting porosity with flux-core wire — what should I check?",
    description: "Flux-core porosity troubleshooting",
    expectations: {
      corpusTypes: ["troubleshooting"],
      sourcePages: [{ page: 43 }],
      textPatterns: [/porosity/i],
      itemIds: ["owner-manual-p43-trouble-004"],
    },
  },
  {
    id: "wire-feed-tension",
    query: "How do I adjust wire feed tension on the OmniPro 220?",
    description: "Wire-feed tension adjustment procedure",
    expectations: {
      minItems: 2,
      textPatterns: [/tension/i, /feed/i],
      sourcePages: [{ page: 17 }, { page: 9 }],
    },
  },
  {
    id: "front-panel-controls",
    query: "What are the front panel controls on the Vulcan OmniPro 220?",
    description: "Front panel control layout",
    expectations: {
      minItems: 2,
      sourcePages: [{ page: 8 }],
      textPatterns: [/front panel|lcd|power switch|socket/i],
    },
  },
  {
    id: "settings-recommendation",
    query: "What voltage and wire speed settings should I use for 1/8 inch mild steel MIG?",
    description: "Settings recommendation from selection chart",
    expectations: {
      corpusTypes: ["settings"],
      textPatterns: [/settings|selection chart|mild steel/i],
      minAmbiguities: 1,
      ambiguityKinds: ["multimodal_required"],
    },
  },
  {
    id: "ambiguous-weld-problem",
    query: "Something is wrong with my weld.",
    description: "Intentionally ambiguous question",
    expectations: {
      minAmbiguities: 1,
      ambiguityKinds: ["missing_process", "ambiguous_symptom"],
    },
  },
];

export interface CaseResult {
  id: string;
  query: string;
  passed: boolean;
  score: number;
  itemCount: number;
  corpusTypesFound: string[];
  pagesFound: number[];
  ambiguityCount: number;
  failures: string[];
  topItems: Array<{ id: string; corpusType: string; score: number; page: number }>;
}

export interface RetrievalEvaluationReport {
  generatedAt: string;
  corpusStats: ReturnType<typeof getCorpusStats>;
  summary: {
    totalCases: number;
    passed: number;
    failed: number;
    passRate: number;
    averageScore: number;
  };
  cases: CaseResult[];
}

function evaluateCase(testCase: EvaluationCase, bundle: RetrievalBundle): CaseResult {
  const items = getAllRetrievedItems(bundle);
  const failures: string[] = [];
  let score = 0;
  const maxScore = 6;

  const { expectations } = testCase;

  if (expectations.minItems !== undefined && items.length < expectations.minItems) {
    failures.push(`Expected at least ${expectations.minItems} items, got ${items.length}`);
  } else if (expectations.minItems !== undefined) {
    score += 1;
  }

  if (expectations.corpusTypes?.length) {
    const found = new Set(items.map((i) => i.corpusType));
    const missing = expectations.corpusTypes.filter((t) => !found.has(t as typeof items[0]["corpusType"]));
    if (missing.length > 0) {
      failures.push(`Missing corpus types: ${missing.join(", ")}`);
    } else {
      score += 1;
    }
  }

  if (expectations.sourcePages?.length) {
    const pageHits = expectations.sourcePages.filter(({ page, source = "owner-manual.pdf" }) =>
      bundle.citations.some((c) => c.page === page && c.source === source),
    );
    if (pageHits.length === 0) {
      failures.push(
        `No citations on expected pages: ${expectations.sourcePages.map((p) => p.page).join(", ")}`,
      );
    } else {
      score += 1;
    }
  }

  if (expectations.textPatterns?.length) {
    const combined = items.map((i) => i.text).join(" ");
    const missingPatterns = expectations.textPatterns.filter((p) => !p.test(combined));
    if (missingPatterns.length > 0) {
      failures.push(`Text patterns not found in retrieved items (${missingPatterns.length} missing)`);
    } else {
      score += 1;
    }
  }

  if (expectations.itemIds?.length) {
    const ids = new Set(items.map((i) => i.id));
    const missingIds = expectations.itemIds.filter((id) => !ids.has(id));
    if (missingIds.length > 0) {
      failures.push(`Expected item IDs not retrieved: ${missingIds.join(", ")}`);
    } else {
      score += 1;
    }
  }

  if (expectations.minAmbiguities !== undefined) {
    if (bundle.ambiguities.length < expectations.minAmbiguities) {
      failures.push(
        `Expected at least ${expectations.minAmbiguities} ambiguities, got ${bundle.ambiguities.length}`,
      );
    } else {
      score += 1;
    }
  }

  if (expectations.ambiguityKinds?.length) {
    const kinds = new Set(bundle.ambiguities.map((a) => a.kind));
    const missingKinds = expectations.ambiguityKinds.filter((k) => !kinds.has(k as typeof bundle.ambiguities[0]["kind"]));
    if (missingKinds.length > 0) {
      failures.push(`Missing ambiguity kinds: ${missingKinds.join(", ")}`);
    } else {
      score += 1;
    }
  }

  const normalizedScore = maxScore > 0 ? score / maxScore : (failures.length === 0 ? 1 : 0);

  return {
    id: testCase.id,
    query: testCase.query,
    passed: failures.length === 0,
    score: normalizedScore,
    itemCount: items.length,
    corpusTypesFound: [...new Set(items.map((i) => i.corpusType))],
    pagesFound: [...new Set(bundle.citations.map((c) => c.page))].sort((a, b) => a - b),
    ambiguityCount: bundle.ambiguities.length,
    failures,
    topItems: items.slice(0, 5).map((i) => ({
      id: i.id,
      corpusType: i.corpusType,
      score: i.score,
      page: i.metadata.page,
    })),
  };
}

export function runRetrievalEvaluation(): RetrievalEvaluationReport {
  const cases: CaseResult[] = [];

  for (const testCase of EVALUATION_CASES) {
    const bundle = retrieve(testCase.query);
    cases.push(evaluateCase(testCase, bundle));
  }

  const passed = cases.filter((c) => c.passed).length;
  const total = cases.length;

  return {
    generatedAt: new Date().toISOString(),
    corpusStats: getCorpusStats(),
    summary: {
      totalCases: total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? passed / total : 0,
      averageScore: cases.reduce((sum, c) => sum + c.score, 0) / (total || 1),
    },
    cases,
  };
}
