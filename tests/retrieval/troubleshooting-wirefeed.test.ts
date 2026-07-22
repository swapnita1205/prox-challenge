import { describe, expect, it, beforeAll } from "vitest";
import {
  retrieve,
  getAllRetrievedItems,
  findItemsByCorpusType,
  hasCitationOnPage,
} from "@/lib/retrieval/engine";
import { resetRetrievalIndex } from "@/lib/retrieval/corpus";
import { findSymptomByName } from "@/lib/knowledge/queries";
import { getKnowledgeGraph } from "@/lib/knowledge/build";

beforeAll(() => {
  resetRetrievalIndex();
});

describe("troubleshooting and wire-feed retrieval (paraphrases)", () => {
  it("retrieves excessive spatter causes from weld diagnosis records", () => {
    const bundle = retrieve("Lots of splatter on my MIG beads — what causes that?");
    const trouble = findItemsByCorpusType(bundle, "troubleshooting");
    const combined = getAllRetrievedItems(bundle).map((i) => i.text).join(" ");

    expect(trouble.length).toBeGreaterThan(0);
    expect(/spatter/i.test(combined)).toBe(true);
    expect(hasCitationOnPage(bundle, 43)).toBe(true);
  });

  it("includes page 43 citation for wire slipping in drive rolls", () => {
    const bundle = retrieve("Wire keeps slipping in the drive rolls — what should I check?");
    expect(hasCitationOnPage(bundle, 43)).toBe(true);
    const combined = getAllRetrievedItems(bundle).map((i) => i.text).join(" ");
    expect(/drive roll|feed roller|tension/i.test(combined)).toBe(true);
  });

  it("maps spatter symptom in the machine graph", () => {
    const graph = getKnowledgeGraph();
    const symptom = findSymptomByName(graph, "spatter");
    expect(symptom).toBeDefined();
    expect(symptom?.name.toLowerCase()).toMatch(/spatter/);
  });

  it("retrieves drive roll change guidance via feed-roller paraphrase", () => {
    const bundle = retrieve("How do I swap feed rollers for a different wire size?");
    const combined = getAllRetrievedItems(bundle).map((i) => i.text).join(" ");

    expect(/drive roll|feed roller/i.test(combined)).toBe(true);
    expect(hasCitationOnPage(bundle, 17) || hasCitationOnPage(bundle, 12)).toBe(true);
  });

  it("retrieves liner replacement guidance from paraphrased query", () => {
    const bundle = retrieve("When should I replace the gun liner on my MIG torch?");
    const combined = getAllRetrievedItems(bundle).map((i) => i.text).join(" ");

    expect(/liner/i.test(combined)).toBe(true);
    expect(hasCitationOnPage(bundle, 17) || hasCitationOnPage(bundle, 16)).toBe(true);
  });

  it("retrieves wire slipping in drive rolls troubleshooting", () => {
    const bundle = retrieve("The wire keeps slipping in the rollers — what should I check?");
    const combined = getAllRetrievedItems(bundle).map((i) => i.text).join(" ");

    expect(/tension|drive roll|feed roller|wire feed pressure/i.test(combined)).toBe(true);
    expect(hasCitationOnPage(bundle, 43) || hasCitationOnPage(bundle, 42)).toBe(true);
  });

  it("retrieves burn-through corrective guidance for thin sheet", () => {
    const bundle = retrieve("I'm melting holes in thin sheet — what should I change?");
    const combined = getAllRetrievedItems(bundle).map((i) => i.text).join(" ");

    expect(/burn|travel speed|wire feed/i.test(combined)).toBe(true);
  });

  it("retrieves porosity troubleshooting via pinholes paraphrase", () => {
    const bundle = retrieve("Pinholes in the weld — gas or polarity issue?");
    const trouble = findItemsByCorpusType(bundle, "troubleshooting");

    expect(trouble.some((t) => /porosity|pinhole|gas/i.test(t.text))).toBe(true);
    expect(hasCitationOnPage(bundle, 43)).toBe(true);
  });
});
