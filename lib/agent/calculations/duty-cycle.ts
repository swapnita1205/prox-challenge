import type { DutyCycleEntry } from "@/lib/retrieval/search";
import { getDutyCycleTable } from "@/lib/retrieval/search";

export interface DutyCycleCalculation {
  process: string;
  inputVoltage: 120 | 240;
  requestedAmps: number;
  ratedEntry: DutyCycleEntry | null;
  continuousEntry: DutyCycleEntry | null;
  applicableDutyPercent: number | null;
  applicableRatedAmps: number | null;
  weldMinutesPer10: number | null;
  restMinutesPer10: number | null;
  exceedsRatedAmps: boolean;
  citation: {
    source: string;
    page: number;
    section?: string;
    excerpt?: string;
  } | null;
  needsReview: boolean;
  message: string;
}

export function calculateDutyCycle(input: {
  process: "mig" | "tig" | "stick" | "flux";
  inputVoltage: 120 | 240;
  amps: number;
}): DutyCycleCalculation {
  const table = getDutyCycleTable();
  const entries = table.filter(
    (r) =>
      r.process === input.process &&
      r.inputVoltage === input.inputVoltage &&
      !r.needsReview,
  );

  const ratedEntries = entries
    .filter((r) => !r.continuous && r.dutyPercent < 100)
    .sort((a, b) => b.amps - a.amps);

  const ratedEntry =
    ratedEntries.find((r) => input.amps >= r.amps) ?? ratedEntries[0] ?? null;

  const continuousEntry =
    entries
      .filter((r) => r.continuous || r.dutyPercent === 100)
      .sort((a, b) => b.amps - a.amps)[0] ?? null;

  const applicableDutyPercent = ratedEntry?.dutyPercent ?? null;
  const applicableRatedAmps = ratedEntry?.amps ?? null;
  const exceedsRatedAmps =
    applicableRatedAmps != null ? input.amps >= applicableRatedAmps : false;

  const weldMinutesPer10 =
    applicableDutyPercent != null ? (applicableDutyPercent / 100) * 10 : null;
  const restMinutesPer10 =
    weldMinutesPer10 != null ? 10 - weldMinutesPer10 : null;

  const citation = ratedEntry
    ? {
        source: ratedEntry.provenance.source,
        page: ratedEntry.provenance.page,
        section: (ratedEntry.provenance as { section?: string }).section,
        excerpt: `${ratedEntry.dutyPercent}% @ ${ratedEntry.amps}A`,
      }
    : null;

  let message: string;
  if (!ratedEntry) {
    message = `No verified duty-cycle row found for ${input.process} at ${input.inputVoltage}V in manual data.`;
  } else if (exceedsRatedAmps) {
    message =
      `At ${input.amps}A on ${input.inputVoltage}V ${input.process.toUpperCase()}, manual rated duty is ` +
      `${ratedEntry.dutyPercent}% at ${ratedEntry.amps}A — weld up to ~${weldMinutesPer10?.toFixed(1)} min per 10 min, ` +
      `then rest ~${restMinutesPer10?.toFixed(1)} min.`;
  } else {
    message =
      `Below the ${ratedEntry.amps}A rated point, ${input.process.toUpperCase()} may run continuously up to ` +
      `${continuousEntry?.amps ?? ratedEntry.amps}A per manual (verify on p${ratedEntry.provenance.page}).`;
  }

  return {
    process: input.process,
    inputVoltage: input.inputVoltage,
    requestedAmps: input.amps,
    ratedEntry,
    continuousEntry,
    applicableDutyPercent,
    applicableRatedAmps,
    weldMinutesPer10,
    restMinutesPer10,
    exceedsRatedAmps,
    citation,
    needsReview: !ratedEntry,
    message,
  };
}
