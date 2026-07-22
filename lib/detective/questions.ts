import type { CandidateFault, DiagnosticQuestion } from "@/lib/detective/schemas";

export interface DetectiveQuestionDef {
  id: string;
  text: string;
  effort: DiagnosticQuestion["effort"];
  safetyRisk: DiagnosticQuestion["safetyRisk"];
  separatesFaultIds: string[];
  rationale: string;
  relevanceBoost?: (ctx: QuestionContext) => number;
  applyAnswer?: (answer: string, ctx: QuestionContext) => QuestionEffect;
}

export interface QuestionContext {
  complaint: string;
  process?: string;
  wireType?: string;
  askedQuestionIds: string[];
}

export interface QuestionEffect {
  configPatch?: Record<string, unknown>;
  supportsFaultIds?: string[];
  contradictsFaultIds?: string[];
  eliminateFaultIds?: string[];
  boostFaultIds?: string[];
  penalizeFaultIds?: string[];
  observationText?: string;
}

function faultIdsMatching(faults: CandidateFault[], pattern: RegExp): string[] {
  return faults.filter((f) => pattern.test(f.label)).map((f) => f.id);
}

function faultIdsByPrefix(faults: CandidateFault[], prefix: string): string[] {
  return faults.filter((f) => f.faultId.includes(prefix) || f.id.includes(prefix)).map((f) => f.id);
}

export const QUESTION_BANK: DetectiveQuestionDef[] = [
  {
    id: "wire_type",
    text: "Is your flux-core wire self-shielded (gasless) or gas-shielded?",
    effort: "low",
    safetyRisk: "low",
    separatesFaultIds: [],
    rationale:
      "Porosity causes differ sharply between gasless and gas-shielded flux wire. Gas-related checks are low value until we know which wire you use.",
    relevanceBoost: (ctx) => (/flux/i.test(ctx.complaint) || ctx.process === "flux" ? 0.35 : 0),
    applyAnswer: (answer) => {
      const lower = answer.toLowerCase();
      if (/self|gasless|no gas/i.test(lower)) {
        return {
          configPatch: { wireType: "flux-self", gasShielded: false, process: "flux" },
          observationText: "User reports self-shielded (gasless) flux-core wire",
        };
      }
      if (/gas.shield|with gas|dual shield/i.test(lower)) {
        return {
          configPatch: { wireType: "flux-gas", gasShielded: true, process: "flux" },
          observationText: "User reports gas-shielded flux-core wire",
        };
      }
      return { observationText: answer };
    },
  },
  {
    id: "polarity_flux",
    text: "For flux-core, is polarity set to DCEN with the ground clamp on the positive (+) socket?",
    effort: "low",
    safetyRisk: "low",
    separatesFaultIds: [],
    rationale:
      "Flux-core on the OmniPro 220 requires DCEN per owner-manual.pdf p.13. Wrong polarity is a common porosity cause and is quick to verify.",
    relevanceBoost: (ctx) => (ctx.process === "flux" || /flux/i.test(ctx.complaint) ? 0.25 : 0.1),
    applyAnswer: (answer) => {
      const lower = answer.toLowerCase();
      if (/yes|correct|dcen|positive.*ground/i.test(lower)) {
        return {
          configPatch: { polarity: "DCEN", process: "flux" },
          observationText: "Polarity verified DCEN for flux",
        };
      }
      if (/no|wrong|dcep|negative.*ground/i.test(lower)) {
        return {
          configPatch: { polarity: "DCEP", process: "flux" },
          observationText: "Polarity may be incorrect for flux-core",
        };
      }
      return { observationText: answer };
    },
  },
  {
    id: "contamination",
    text: "Is the base metal or wire visibly rusty, oily, painted, or dirty?",
    effort: "low",
    safetyRisk: "low",
    separatesFaultIds: [],
    rationale:
      "Dirty workpiece and contaminated wire are listed porosity causes in the manual (p.43). This is easy to inspect before changing machine settings.",
    applyAnswer: (answer) => {
      const lower = answer.toLowerCase();
      if (/yes|dirty|rust|oil|paint/i.test(lower)) {
        return { observationText: "Visible contamination on workpiece or wire" };
      }
      if (/no|clean/i.test(lower)) {
        return { observationText: "No obvious contamination seen" };
      }
      return { observationText: answer };
    },
  },
  {
    id: "gas_flow",
    text: "If you use shielding gas, do you get steady gas flow at the nozzle when you press the trigger?",
    effort: "medium",
    safetyRisk: "low",
    separatesFaultIds: [],
    rationale:
      "Empty bottle or incorrect flow are leading porosity causes for gas-shielded processes. This question only matters after we know you use gas.",
    relevanceBoost: (ctx) => (ctx.wireType === "flux-gas" ? 0.45 : ctx.process === "mig" ? 0.25 : 0),
    applyAnswer: (answer) => {
      const lower = answer.toLowerCase();
      if (/no|empty|weak|none/i.test(lower)) {
        return { observationText: "Insufficient or no shielding gas flow reported" };
      }
      if (/yes|steady|good/i.test(lower)) {
        return { observationText: "Gas flow appears normal" };
      }
      return { observationText: answer };
    },
  },
  {
    id: "outdoor_wind",
    text: "Are you welding outdoors or in a drafty area where wind could blow shielding gas away?",
    effort: "low",
    safetyRisk: "low",
    separatesFaultIds: [],
    rationale:
      "Wind can cause porosity with gas-shielded welding even when the machine is set correctly.",
    relevanceBoost: (ctx) => (ctx.wireType === "flux-gas" || ctx.process === "mig" ? 0.15 : 0),
    applyAnswer: (answer) => {
      const lower = answer.toLowerCase();
      if (/yes|wind|outdoor|draft|breeze/i.test(lower)) {
        return { observationText: "Welding in windy or outdoor conditions" };
      }
      return { observationText: answer };
    },
  },
  {
    id: "wire_feed",
    text: "Does the wire feed smoothly without slipping, bird-nesting, or stopping?",
    effort: "medium",
    safetyRisk: "low",
    separatesFaultIds: [],
    rationale:
      "Erratic wire feed can cause arc instability that mimics porosity symptoms; the manual lists wire-feed issues separately from gas causes.",
    applyAnswer: (answer) => {
      const lower = answer.toLowerCase();
      if (/no|slip|bird|stop|jam/i.test(lower)) {
        return { observationText: "Wire feed problems reported" };
      }
      return { observationText: answer };
    },
  },
  {
    id: "process_confirm",
    text: "Which process are you using — MIG solid core, flux-core, TIG, or stick?",
    effort: "low",
    safetyRisk: "low",
    separatesFaultIds: [],
    rationale:
      "Porosity causes and polarity differ by process. This narrows which manual faults apply.",
    relevanceBoost: (ctx) => {
      if (!ctx.process && !/flux|mig|tig|stick/i.test(ctx.complaint)) return 0.3;
      return 0;
    },
    applyAnswer: (answer) => {
      const lower = answer.toLowerCase();
      if (/flux/i.test(lower)) return { configPatch: { process: "flux" }, observationText: answer };
      if (/mig|solid/i.test(lower)) return { configPatch: { process: "mig" }, observationText: answer };
      if (/tig/i.test(lower)) return { configPatch: { process: "tig" }, observationText: answer };
      if (/stick/i.test(lower)) return { configPatch: { process: "stick" }, observationText: answer };
      return { observationText: answer };
    },
  },
];

function resolveSeparatesFaultIds(q: DetectiveQuestionDef, faults: CandidateFault[]): string[] {
  if (q.separatesFaultIds.length > 0) return q.separatesFaultIds;

  if (q.id === "wire_type") {
    const gas = faults.filter((f) => /shielding gas|gas bottle|gas regulator/i.test(f.label)).map((f) => f.id);
    const nonGas = faults.filter((f) => !/shielding gas|gas bottle|gas regulator/i.test(f.label)).map((f) => f.id);
    return [...gas, ...nonGas];
  }
  if (q.id === "polarity_flux") {
    return faultIdsByPrefix(faults, "fault-polarity");
  }
  if (q.id === "contamination") {
    return [
      ...faultIdsMatching(faults, /dirty workpiece/i),
      ...faultIdsMatching(faults, /dirty welding wire/i),
    ];
  }
  if (q.id === "gas_flow") {
    return faultIdsMatching(faults, /shielding gas|gas bottle/i);
  }
  return faults.filter((f) => !f.eliminated).map((f) => f.id);
}

function effortPenalty(effort: DiagnosticQuestion["effort"]): number {
  return effort === "low" ? 0 : effort === "medium" ? 0.08 : 0.18;
}

function safetyPenalty(risk: DiagnosticQuestion["safetyRisk"]): number {
  return risk === "low" ? 0 : risk === "medium" ? 0.12 : 0.25;
}

export function selectNextQuestion(
  faults: CandidateFault[],
  ctx: QuestionContext,
): DiagnosticQuestion | null {
  const activeFaults = faults.filter((f) => !f.eliminated && f.score > 0.05);
  if (activeFaults.length <= 1) return null;

  const asked = new Set(ctx.askedQuestionIds);
  let best: { q: DetectiveQuestionDef; score: number; separates: number } | null = null;

  for (const q of QUESTION_BANK) {
    if (asked.has(q.id)) continue;

    if (q.id === "gas_flow" && ctx.wireType === "flux-self") continue;
    if (q.id === "outdoor_wind" && ctx.wireType === "flux-self") continue;

    const separatesIds = resolveSeparatesFaultIds(q, activeFaults);
    const separates = separatesIds.filter((id) =>
      activeFaults.some((f) => f.id === id && f.score > 0.08),
    ).length;

    if (separates < 2 && q.id !== "wire_type" && q.id !== "process_confirm") continue;

    const infoGain = activeFaults.length > 0 ? separates / activeFaults.length : 0;
    const realism = q.relevanceBoost?.(ctx) ?? 0;
    const score =
      infoGain * 0.55 +
      realism +
      0.2 -
      effortPenalty(q.effort) -
      safetyPenalty(q.safetyRisk);

    if (!best || score > best.score) {
      best = { q, score, separates };
    }
  }

  if (!best) return null;

  return {
    id: best.q.id,
    text: best.q.text,
    rationale: best.q.rationale,
    expectedInfoGain: Math.round(best.score * 100) / 100,
    effort: best.q.effort,
    safetyRisk: best.q.safetyRisk,
    separatesFaultCount: best.separates,
  };
}

export function getQuestionDef(id: string): DetectiveQuestionDef | undefined {
  return QUESTION_BANK.find((q) => q.id === id);
}

export function applyQuestionAnswer(
  questionId: string,
  answer: string,
  faults: CandidateFault[],
  ctx: QuestionContext,
): QuestionEffect {
  const def = getQuestionDef(questionId);
  if (!def?.applyAnswer) return { observationText: answer };

  const effect = def.applyAnswer(answer, ctx);

  const lower = answer.toLowerCase();
  if (questionId === "wire_type" && /self|gasless/i.test(lower)) {
    effect.eliminateFaultIds = faults
      .filter((f) => /shielding gas bottle|not enough or too much shielding gas/i.test(f.label))
      .map((f) => f.id);
    effect.penalizeFaultIds = [
      ...(effect.penalizeFaultIds ?? []),
      ...faults.filter((f) => /shielding gas/i.test(f.label)).map((f) => f.id),
    ];
  }
  if (questionId === "polarity_flux" && /no|wrong/i.test(lower)) {
    effect.boostFaultIds = [
      ...(effect.boostFaultIds ?? []),
      ...faults.filter((f) => /polarity/i.test(f.label)).map((f) => f.id),
    ];
  }
  if (questionId === "contamination" && /yes|dirty|rust/i.test(lower)) {
    effect.boostFaultIds = [
      ...faultIdsMatching(faults, /dirty workpiece/i),
      ...faultIdsMatching(faults, /dirty welding wire/i),
    ];
  }
  if (questionId === "gas_flow" && /no|empty|weak/i.test(lower)) {
    effect.boostFaultIds = faults.filter((f) => /shielding gas|gas bottle/i.test(f.label)).map((f) => f.id);
  }
  if (questionId === "gas_flow" && /yes|steady/i.test(lower)) {
    effect.penalizeFaultIds = faults.filter((f) => /shielding gas bottle is empty/i.test(f.label)).map((f) => f.id);
  }
  if (questionId === "contamination" && /no|clean/i.test(lower)) {
    effect.penalizeFaultIds = [
      ...faultIdsMatching(faults, /dirty workpiece/i),
      ...faultIdsMatching(faults, /dirty welding wire/i),
    ];
  }

  return effect;
}
