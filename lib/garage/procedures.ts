import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import type { GarageProcedure, GarageStep } from "@/lib/garage/schemas";
import { buildSpeakText, shortenStepLabel } from "@/lib/garage/support";
import type { Citation } from "@/lib/schemas/conversation";

function checklistToProcedure(
  spec: Extract<ArtifactSpec, { type: "step-by-step-checklist" }>,
  id: string,
): GarageProcedure {
  const steps: GarageStep[] = spec.steps.map((s) => ({
    id: s.id,
    shortLabel: shortenStepLabel(s.label),
    speakText: buildSpeakText(s.label, s.detail),
    safetyCritical: s.safetyCritical,
    citation: spec.citations?.[0],
  }));

  return {
    id,
    title: spec.title ?? "Setup procedure",
    steps,
    citations: spec.citations ?? [],
  };
}

function polarityToSteps(
  spec: Extract<ArtifactSpec, { type: "polarity-diagram" }>,
): GarageStep[] {
  return [
    {
      id: "polarity-ground",
      shortLabel: `${spec.groundLabel} → ${spec.groundSocket} socket`,
      speakText: `Connect ${spec.groundLabel} to the ${spec.groundSocket} socket.`,
      citation: spec.citations?.[0],
    },
    {
      id: "polarity-electrode",
      shortLabel: `${spec.electrodeLabel} → ${spec.electrodeSocket} socket`,
      speakText: `Connect ${spec.electrodeLabel} to the ${spec.electrodeSocket} socket.`,
      citation: spec.citations?.[0],
    },
    {
      id: "polarity-lock",
      shortLabel: "Twist cables clockwise to lock",
      speakText: "Twist both cables clockwise until they lock in place.",
      citation: spec.citations?.[0],
    },
  ];
}

export function extractProcedureFromArtifacts(
  artifacts: Record<string, { spec: ArtifactSpec }>,
  preferType: "step-by-step-checklist" | "polarity-diagram" = "step-by-step-checklist",
): GarageProcedure | null {
  const entries = Object.entries(artifacts);

  if (preferType === "step-by-step-checklist") {
    const checklist = entries.find(([, a]) => a.spec.type === "step-by-step-checklist");
    if (checklist) {
      const [, inst] = checklist;
      if (inst.spec.type === "step-by-step-checklist") {
        return checklistToProcedure(inst.spec, checklist[0]);
      }
    }
  }

  const polarity = entries.find(([, a]) => a.spec.type === "polarity-diagram");
  if (polarity) {
    const [, inst] = polarity;
    if (inst.spec.type === "polarity-diagram") {
      return {
        id: polarity[0],
        title: inst.spec.title ?? "Polarity setup",
        steps: polarityToSteps(inst.spec),
        citations: inst.spec.citations ?? [],
      };
    }
  }

  const anyChecklist = entries.find(([, a]) => a.spec.type === "step-by-step-checklist");
  if (anyChecklist) {
    const [, inst] = anyChecklist;
    if (inst.spec.type === "step-by-step-checklist") {
      return checklistToProcedure(inst.spec, anyChecklist[0]);
    }
  }

  return null;
}

export function mergeCitations(...groups: Citation[][]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const group of groups) {
    for (const c of group) {
      const key = `${c.source}:${c.page}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(c);
      }
    }
  }
  return out;
}
