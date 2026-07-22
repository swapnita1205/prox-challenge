import type { Hypothesis } from "@/lib/schemas/conversation";

export function createDefaultHypotheses(symptom: string): Hypothesis[] {
  const lower = symptom.toLowerCase();
  if (lower.includes("porosity")) {
    return [
      {
        id: "polarity",
        label: "Incorrect polarity",
        posterior: 0.3,
        evidence: ["owner-manual.pdf p37"],
      },
      {
        id: "gas",
        label: "Insufficient shielding gas",
        posterior: 0.25,
        evidence: ["owner-manual.pdf p37"],
      },
      {
        id: "dirty",
        label: "Dirty workpiece or wire",
        posterior: 0.2,
        evidence: ["owner-manual.pdf p37"],
      },
      {
        id: "ctwd",
        label: "CTWD too long",
        posterior: 0.15,
        evidence: ["owner-manual.pdf p37"],
      },
      {
        id: "travel",
        label: "Inconsistent travel speed",
        posterior: 0.1,
        evidence: ["owner-manual.pdf p37"],
      },
    ];
  }

  return [
    {
      id: "unknown",
      label: "Further clarification needed",
      posterior: 1.0,
      evidence: [],
    },
  ];
}

export function pickClarificationQuestion(
  hypotheses: Hypothesis[],
  asked: string[],
): string | null {
  const candidates = [
    "Which welding process are you using — MIG, flux-cored, TIG, or stick?",
    "Are you running on 120V or 240V input?",
    "Is this solid-core MIG with shielding gas, or flux-cored wire?",
    "Have you verified polarity matches your process?",
  ];

  return candidates.find((q) => !asked.includes(q)) ?? null;
}
