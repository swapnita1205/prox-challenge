import type {
  CandidateFault,
  DiagnosticSession,
  MachineConfigurationSnapshot,
  Observation,
} from "@/lib/detective/schemas";
import { normalizeScores, isGasRelatedFault, isPolarityFault } from "@/lib/detective/candidates";

export interface BeliefUpdateInput {
  observation?: Observation;
  configPatch?: Partial<MachineConfigurationSnapshot>;
  eliminateFaultIds?: string[];
  boostFaultIds?: string[];
  penalizeFaultIds?: string[];
}

function applyConfigCompatibility(
  fault: CandidateFault,
  config: MachineConfigurationSnapshot,
): number {
  let factor = 1;

  if (config.process && fault.compatibleProcesses.length > 0) {
    if (!fault.compatibleProcesses.includes(config.process)) factor *= 0.35;
  }

  if (config.process === "flux" && config.wireType === "flux-self" && isGasRelatedFault(fault.label)) {
    factor *= 0.15;
  }
  if (config.process === "flux" && config.wireType === "flux-gas" && isGasRelatedFault(fault.label)) {
    factor *= 1.25;
  }

  if (config.polarity === "DCEN" && isPolarityFault(fault.label)) {
    factor *= 0.4;
  }
  if (config.polarity === "DCEP" && isPolarityFault(fault.label) && config.process === "flux") {
    factor *= 1.3;
  }

  if (config.gasShielded === false && isGasRelatedFault(fault.label)) {
    factor *= 0.1;
  }
  if (config.gasShielded === true && isGasRelatedFault(fault.label)) {
    factor *= 1.2;
  }

  return factor;
}

function inspectionCostPenalty(fault: CandidateFault): number {
  return fault.inspectionCost === "low" ? 1 : fault.inspectionCost === "medium" ? 0.95 : 0.85;
}

export function updateBeliefs(
  faults: CandidateFault[],
  session: Pick<DiagnosticSession, "machineConfiguration" | "observations" | "eliminatedFaultIds">,
  input: BeliefUpdateInput = {},
): CandidateFault[] {
  const config = { ...session.machineConfiguration, ...input.configPatch };
  const eliminated = new Set([
    ...session.eliminatedFaultIds,
    ...(input.eliminateFaultIds ?? []),
  ]);

  let updated = faults.map((fault) => {
    if (eliminated.has(fault.id)) {
      return {
        ...fault,
        score: 0,
        eliminated: true,
        contradictEvidence: [...fault.contradictEvidence, "Ruled out by observation or user check"],
      };
    }

    let score = fault.manualRelevance;

    score *= applyConfigCompatibility(fault, config);
    score *= inspectionCostPenalty(fault);

    for (const obs of session.observations) {
      if (obs.supportsFaultIds.includes(fault.id)) score *= 1.35;
      if (obs.contradictsFaultIds.includes(fault.id)) score *= 0.25;
    }

    if (input.observation) {
      if (input.observation.supportsFaultIds.includes(fault.id)) score *= 1.5;
      if (input.observation.contradictsFaultIds.includes(fault.id)) score *= 0.2;
    }

    if (input.boostFaultIds?.includes(fault.id)) score *= 1.4;
    if (input.penalizeFaultIds?.includes(fault.id)) score *= 0.3;

    return { ...fault, score, eliminated: false };
  });

  updated = normalizeScores(updated);
  return updated;
}

export function computeUncertainty(faults: CandidateFault[]): number {
  const active = faults.filter((f) => !f.eliminated && f.score > 0.01);
  if (active.length <= 1) return 0.15;
  const entropy = -active.reduce((sum, f) => {
    const p = Math.max(f.score, 0.001);
    return sum + p * Math.log2(p);
  }, 0);
  const maxEntropy = Math.log2(active.length);
  return maxEntropy > 0 ? Math.min(1, entropy / maxEntropy) : 0.5;
}

export function computeDiagnosticConfidence(uncertainty: number): number {
  return Math.round((1 - uncertainty) * 100) / 100;
}

export function countPlausibleCauses(faults: CandidateFault[], threshold = 0.08): number {
  return faults.filter((f) => !f.eliminated && f.score >= threshold).length;
}

export function getTopFault(faults: CandidateFault[]): CandidateFault | null {
  const active = faults.filter((f) => !f.eliminated).sort((a, b) => b.score - a.score);
  return active[0] ?? null;
}
