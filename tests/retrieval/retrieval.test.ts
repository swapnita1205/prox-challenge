import { describe, it, expect } from "vitest";
import {
  retrieve,
  getAllRetrievedItems,
  hasEvidenceMatching,
  hasCitationOnPage,
  findItemsByCorpusType,
} from "@/lib/retrieval/engine";
import { decomposeQuery } from "@/lib/retrieval/decompose";
import { extractQueryDimensions } from "@/lib/retrieval/dimensions";
import { EVALUATION_CASES, runRetrievalEvaluation } from "@/lib/retrieval/evaluate";
import { formatCitationLine } from "@/lib/retrieval/citations";
import { getCorpusStats } from "@/lib/retrieval/corpus";

describe("retrieval corpus", () => {
  it("indexes all required corpus types", () => {
    const stats = getCorpusStats();
    expect(stats.total).toBeGreaterThan(500);
    expect(stats.byType.text_section).toBeGreaterThan(0);
    expect(stats.byType.table).toBeGreaterThan(0);
    expect(stats.byType.figure).toBeGreaterThan(0);
    expect(stats.byType.warning).toBeGreaterThan(0);
    expect(stats.byType.troubleshooting).toBeGreaterThan(0);
    expect(stats.byType.polarity).toBeGreaterThan(0);
    expect(stats.byType.settings).toBeGreaterThan(0);
    expect(stats.byType.duty_cycle).toBeGreaterThan(0);
    expect(stats.byType.graph_relationship).toBeGreaterThan(0);
  });
});

describe("query decomposition", () => {
  it("decomposes TIG polarity + ground clamp into multiple tasks", () => {
    const query = "What polarity setup do I need for TIG, and where does the ground clamp go?";
    const dims = extractQueryDimensions(query);
    const tasks = decomposeQuery(query, dims);

    expect(dims.processes).toContain("tig");
    expect(tasks.some((t) => t.intent === "polarity")).toBe(true);
    expect(tasks.some((t) => t.id === "task-tig-ground")).toBe(true);
    expect(tasks.length).toBeGreaterThan(2);
  });
});

describe("retrieval evidence", () => {
  it("retrieves MIG duty cycle evidence at 200A and 240V", () => {
    const bundle = retrieve("What is the MIG duty cycle at 200 amps on 240V?");

    expect(
      hasEvidenceMatching(
        bundle,
        (i) =>
          i.corpusType === "duty_cycle" &&
          i.metadata.processes.includes("mig") &&
          i.metadata.inputVoltage === 240 &&
          i.metadata.outputAmps === 200,
      ),
    ).toBe(true);

    expect(hasCitationOnPage(bundle, 7)).toBe(true);
    expect(
      getAllRetrievedItems(bundle).some((i) => i.id === "owner-manual-p07-duty-2f6d5a479400"),
    ).toBe(true);
  });

  it("retrieves TIG polarity and work-clamp socket evidence", () => {
    const bundle = retrieve(
      "What polarity setup do I need for TIG, and where does the ground clamp go?",
    );

    const combined = getAllRetrievedItems(bundle)
      .map((i) => i.text)
      .join(" ");

    expect(/tig/i.test(combined)).toBe(true);
    expect(/positive/i.test(combined)).toBe(true);
    expect(/ground clamp/i.test(combined)).toBe(true);
    expect(hasCitationOnPage(bundle, 24)).toBe(true);
  });

  it("retrieves flux-core porosity troubleshooting evidence", () => {
    const bundle = retrieve(
      "I'm getting porosity with flux-core wire — what should I check?",
    );

    const trouble = findItemsByCorpusType(bundle, "troubleshooting");
    expect(trouble.length).toBeGreaterThan(0);
    expect(trouble.some((t) => /porosity/i.test(t.text))).toBe(true);
    expect(hasCitationOnPage(bundle, 43)).toBe(true);
    expect(
      getAllRetrievedItems(bundle).some((i) => i.id === "owner-manual-p43-trouble-004"),
    ).toBe(true);
  });

  it("retrieves wire-feed tension evidence", () => {
    const bundle = retrieve("How do I adjust wire feed tension on the OmniPro 220?");

    const combined = getAllRetrievedItems(bundle)
      .map((i) => i.text)
      .join(" ");

    expect(/tension/i.test(combined)).toBe(true);
    expect(/feed/i.test(combined)).toBe(true);
    expect(
      hasCitationOnPage(bundle, 17) || hasCitationOnPage(bundle, 9),
    ).toBe(true);
  });

  it("retrieves front-panel controls evidence", () => {
    const bundle = retrieve("What are the front panel controls on the Vulcan OmniPro 220?");

    const combined = getAllRetrievedItems(bundle)
      .map((i) => i.text)
      .join(" ");

    expect(/front panel|lcd|power switch|socket/i.test(combined)).toBe(true);
    expect(hasCitationOnPage(bundle, 8)).toBe(true);
  });

  it("retrieves settings chart evidence and flags multimodal ambiguity", () => {
    const bundle = retrieve(
      "What voltage and wire speed settings should I use for 1/8 inch mild steel MIG?",
    );

    expect(findItemsByCorpusType(bundle, "settings").length).toBeGreaterThan(0);
    expect(bundle.ambiguities.some((a) => a.kind === "multimodal_required")).toBe(true);
  });

  it("surfaces ambiguities for vague weld problem questions", () => {
    const bundle = retrieve("Something is wrong with my weld.");

    expect(bundle.ambiguities.length).toBeGreaterThan(0);
    expect(
      bundle.ambiguities.some(
        (a) => a.kind === "missing_process" || a.kind === "ambiguous_symptom",
      ),
    ).toBe(true);
  });
});

describe("citation formatting", () => {
  it("formats citations with source, page, section, and asset ID", () => {
    const bundle = retrieve("MIG duty cycle 200 amps 240V");
    const item = getAllRetrievedItems(bundle)[0];
    expect(item).toBeDefined();

    const citation = item!.citation;
    expect(citation.source).toMatch(/\.pdf$/);
    expect(citation.page).toBeGreaterThan(0);
    expect(citation.assetId).toMatch(/^manual-assets\//);

    const line = formatCitationLine(citation);
    expect(line).toContain(citation.source);
    expect(line).toContain(`p.${citation.page}`);
  });
});

describe("retrieval evaluation report", () => {
  it("passes all evaluation cases", () => {
    const report = runRetrievalEvaluation();
    expect(report.summary.totalCases).toBe(EVALUATION_CASES.length);
    expect(report.summary.passRate).toBe(1);

    const failed = report.cases.filter((c) => !c.passed);
    if (failed.length > 0) {
      const details = failed.map((c) => `${c.id}: ${c.failures.join("; ")}`).join("\n");
      throw new Error(`Evaluation failures:\n${details}`);
    }
  });
});
