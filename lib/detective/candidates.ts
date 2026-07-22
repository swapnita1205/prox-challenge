import { getKnowledgeGraph } from "@/lib/knowledge/build";
import { matchCanonicalInText } from "@/lib/troubleshooting";
import type { KnowledgeGraph } from "@/lib/knowledge/graph";
import {
  findFaultsForSymptom,
  findSymptomByName,
  getCorrectiveActionsForFault,
} from "@/lib/knowledge/queries";
import type { CandidateFault, MachineConfigurationSnapshot } from "@/lib/detective/schemas";
import type { Citation } from "@/lib/schemas/conversation";

function matchSymptomName(complaint: string): string {
  const canonical = matchCanonicalInText(complaint);
  if (canonical.length > 0) return canonical[0]!;
  return complaint.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
}

function evidenceToCitations(
  evidence: Array<{ provenance: { source: string; page: number; section?: string }; excerpt?: string }>,
): Citation[] {
  return evidence.map((e) => ({
    source: e.provenance.source,
    page: e.provenance.page,
    section: e.provenance.section,
    excerpt: e.excerpt?.slice(0, 200),
  }));
}

function inferInspectionCost(label: string): CandidateFault["inspectionCost"] {
  const lower = label.toLowerCase();
  if (/gas bottle|polarity|wire feed|tension/.test(lower)) return "low";
  if (/ctwd|distance|wind|draft/.test(lower)) return "medium";
  return "medium";
}

function inferProcessCompatibility(label: string): string[] {
  const lower = label.toLowerCase();
  const processes: string[] = [];
  if (/shielding gas|gas bottle|gas regulator|ctwd/.test(lower)) {
    processes.push("mig", "flux");
  }
  if (/polarity|flux/.test(lower)) processes.push("flux", "mig");
  if (/tig|argon/.test(lower)) processes.push("tig");
  if (processes.length === 0) return ["mig", "flux", "tig", "stick"];
  return [...new Set(processes)];
}

function isGasRelatedFault(label: string): boolean {
  return /shielding gas|gas bottle|gas regulator|gas flow|gasless/i.test(label);
}

function isPolarityFault(label: string): boolean {
  return /polarity/i.test(label);
}

export function generateCandidates(
  complaint: string,
  config: MachineConfigurationSnapshot,
  graph: KnowledgeGraph = getKnowledgeGraph(),
): CandidateFault[] {
  const symptomKey = matchSymptomName(complaint);
  const symptom =
    findSymptomByName(graph, symptomKey) ??
    findSymptomByName(graph, "porosity") ??
    findSymptomByName(graph, complaint);

  if (!symptom) {
    return [
      {
        id: "fault-unknown",
        faultId: "fault-unknown",
        label: "Further manual lookup required",
        score: 1,
        supportEvidence: [],
        contradictEvidence: [],
        eliminated: false,
        compatibleProcesses: ["mig", "flux", "tig", "stick"],
        manualRelevance: 0.3,
        inspectionCost: "low",
      },
    ];
  }

  const faultLinks = findFaultsForSymptom(graph, symptom.id);
  const candidates: CandidateFault[] = [];

  for (const link of faultLinks) {
    if (!link.fault) continue;
    const label = link.fault.name;
    let manualRelevance = link.relationship.confidence ?? 0.7;
    if (link.relationship.verificationStatus === "verified") manualRelevance = Math.min(1, manualRelevance + 0.1);

    let processPenalty = 1;
    const compatible = inferProcessCompatibility(label);
    if (config.process && !compatible.includes(config.process)) {
      processPenalty = 0.4;
    }

    if (config.process === "flux" && config.wireType === "flux-self" && isGasRelatedFault(label)) {
      processPenalty *= 0.25;
    }
    if (config.process === "flux" && config.wireType === "flux-gas" && isGasRelatedFault(label)) {
      processPenalty *= 1.1;
    }

    const baseScore = manualRelevance * processPenalty;

    candidates.push({
      id: link.fault.id,
      faultId: link.fault.id,
      label,
      score: baseScore,
      supportEvidence: evidenceToCitations(link.evidence),
      contradictEvidence: [],
      eliminated: false,
      compatibleProcesses: compatible,
      manualRelevance,
      inspectionCost: inferInspectionCost(label),
    });
  }

  return normalizeScores(candidates);
}

export function normalizeScores(faults: CandidateFault[]): CandidateFault[] {
  const active = faults.filter((f) => !f.eliminated);
  const total = active.reduce((s, f) => s + f.score, 0) || 1;
  return faults.map((f) =>
    f.eliminated ? { ...f, score: 0 } : { ...f, score: f.score / total },
  );
}

export function getRecommendedActionsForFaultId(
  faultId: string,
  graph: KnowledgeGraph = getKnowledgeGraph(),
): string[] {
  return getCorrectiveActionsForFault(graph, faultId)
    .map((a) => a.action?.name)
    .filter((n): n is string => !!n);
}

export { isGasRelatedFault, isPolarityFault, matchSymptomName };
