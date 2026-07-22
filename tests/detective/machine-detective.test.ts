import { describe, expect, it, beforeEach } from "vitest";
import {
  answerDiagnosticQuestion,
  buildSnapshot,
  markAlreadyChecked,
  startDiagnosticSession,
} from "@/lib/detective/engine";
import { selectNextQuestion } from "@/lib/detective/questions";
import { resetServerSessions } from "@/lib/detective/persist";

describe("Machine Detective — multi-turn paths", () => {
  beforeEach(() => {
    resetServerSessions();
  });

  it("flux-core porosity: asks wire type first, not all causes", () => {
    const session = startDiagnosticSession("I'm getting porosity with flux-core.");

    expect(session.candidateFaults.length).toBeGreaterThan(3);
    expect(session.currentQuestion).not.toBeNull();
    expect(session.currentQuestion?.id).toBe("wire_type");

    const snapshot = buildSnapshot(session);
    expect(snapshot.rankedHypotheses.length).toBeGreaterThan(0);
    expect(session.plausibleCauseCount).toBeGreaterThan(2);
    expect(session.diagnosticConfidence).toBeLessThan(0.5);
  });

  it("flux-core porosity path: self-shielded wire eliminates gas causes", () => {
    let session = startDiagnosticSession("I'm getting porosity with flux-core.");
    expect(session.currentQuestion?.id).toBe("wire_type");

    session = answerDiagnosticQuestion(session, "wire_type", "self-shielded gasless wire");

    const gasFaults = session.candidateFaults.filter((f) =>
      /shielding gas bottle|not enough or too much shielding gas/i.test(f.label),
    );
    expect(gasFaults.every((f) => f.eliminated)).toBe(true);
    expect(session.eliminatedFaultIds.length).toBeGreaterThanOrEqual(2);
    expect(session.plausibleCauseCount).toBeLessThan(session.candidateFaults.length);

    const next = session.currentQuestion;
    expect(next).not.toBeNull();
    expect(next?.id).not.toBe("gas_flow");
  });

  it("flux-core porosity path: wrong polarity boosts polarity fault", () => {
    let session = startDiagnosticSession("porosity with flux-core wire");
    session = answerDiagnosticQuestion(session, "wire_type", "self-shielded");
    session = answerDiagnosticQuestion(session, "polarity_flux", "no, polarity is wrong");

    const polarityFault = session.candidateFaults.find((f) => /polarity/i.test(f.label));
    expect(polarityFault).toBeDefined();
    expect(polarityFault!.score).toBeGreaterThan(0.15);

    const snapshot = buildSnapshot(session);
    const top = snapshot.rankedHypotheses[0];
    expect(top?.label.toLowerCase()).toMatch(/polarity|dirty|workpiece|wire|ctwd|gun/);
    expect(session.diagnosticConfidence).toBeGreaterThan(0);
  });

  it("gas-shielded flux path: gas flow question becomes relevant", () => {
    let session = startDiagnosticSession("porosity on flux-core MIG");
    session = answerDiagnosticQuestion(session, "wire_type", "gas-shielded dual shield");

    const ctx = {
      complaint: session.originalComplaint,
      process: session.machineConfiguration.process,
      wireType: session.machineConfiguration.wireType,
      askedQuestionIds: session.questionsAsked.map((q) => q.id),
    };
    const next = selectNextQuestion(session.candidateFaults, ctx);
    expect(["gas_flow", "polarity_flux", "contamination", "outdoor_wind"]).toContain(next?.id);
  });

  it("contamination answer boosts dirty-workpiece hypotheses", () => {
    let session = startDiagnosticSession("porosity in weld");
    session = answerDiagnosticQuestion(session, "wire_type", "self-shielded");
    session = answerDiagnosticQuestion(session, "contamination", "yes, oily and rusty");

    const dirty = session.candidateFaults.filter((f) => /dirty/i.test(f.label) && !f.eliminated);
    expect(dirty.length).toBeGreaterThan(0);
    const maxDirty = Math.max(...dirty.map((f) => f.score));
    const avgOther = session.candidateFaults
      .filter((f) => !f.eliminated && !/dirty/i.test(f.label))
      .reduce((s, f) => s + f.score, 0);
    expect(maxDirty).toBeGreaterThan(0.1);
    expect(avgOther).toBeGreaterThan(0);
  });

  it("already checked records action and advances session", () => {
    let session = startDiagnosticSession("flux-core porosity");
    const qId = session.currentQuestion!.id;
    session = markAlreadyChecked(session, qId, "Checked — looks fine");

    expect(session.actionsAttempted.some((a) => a.includes("Checked"))).toBe(true);
    expect(session.questionsAsked.some((q) => q.id === qId)).toBe(true);
  });

  it("MIG solid porosity: process-specific questions apply", () => {
    const session = startDiagnosticSession("porosity with solid MIG wire");
    expect(session.candidateFaults.length).toBeGreaterThan(0);
    const q = session.currentQuestion;
    expect(q).not.toBeNull();
    expect([
      "wire_type",
      "process_confirm",
      "contamination",
      "gas_flow",
      "outdoor_wind",
    ]).toContain(q?.id);
  });
});

describe("Machine Detective — belief stability", () => {
  it("scores remain normalized after updates", () => {
    let session = startDiagnosticSession("porosity");
    session = answerDiagnosticQuestion(session, "wire_type", "gas-shielded");
    const active = session.candidateFaults.filter((f) => !f.eliminated);
    const sum = active.reduce((s, f) => s + f.score, 0);
    expect(sum).toBeCloseTo(1, 2);
  });

  it("does not list every cause as top hypothesis on turn one", () => {
    const session = startDiagnosticSession("I'm getting porosity with flux-core.");
    const top = buildSnapshot(session).rankedHypotheses[0];
    expect(top.score).toBeLessThan(0.5);
  });
});
