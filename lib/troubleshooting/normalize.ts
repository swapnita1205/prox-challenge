import troubleshootingData from "@/data/generated/troubleshooting.json";
import { MANUAL_DEFECT_EXEMPLARS } from "@/lib/vision/exemplars";
import { aliasTermsFor, expandQueryTerms, matchCanonicalInText } from "@/lib/troubleshooting/synonyms";
import type { NormalizedTroubleshootingRecord } from "@/lib/troubleshooting/types";

type IngestTrouble = {
  id: string;
  problem: string;
  possibleCauses: string;
  likelySolutions: string;
  processes: string[];
  needsReview?: boolean;
  provenance: {
    source: string;
    page: number;
    section?: string;
    neighboringText?: string;
  };
};

function parseNumberedList(text: string): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\d+\.\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function parseProblem(raw: IngestTrouble): string | null {
  if (raw.problem && raw.problem.length >= 8) {
    if (/follow all safety|safety alert symbol|hazardous situation/i.test(raw.problem)) return null;
    return raw.problem.trim();
  }
  const neighbor = raw.provenance.neighboringText ?? "";
  const fromPipe = neighbor.split("|").map((s) => s.trim())[0];
  if (fromPipe && fromPipe.length >= 8 && !/follow all safety/i.test(fromPipe)) {
    return fromPipe;
  }
  return null;
}

function inferProcesses(text: string, existing: string[] = []): string[] {
  if (existing.length) return existing;
  const lower = text.toLowerCase();
  const found: string[] = [];
  if (/\bmig\b|solid core|gas shielded/i.test(lower)) found.push("mig");
  if (/flux[- ]?core|gasless|self-shielded/i.test(lower)) found.push("flux");
  if (/\btig\b/i.test(lower)) found.push("tig");
  if (/\bstick\b/i.test(lower)) found.push("stick");
  return found.length ? found : ["mig", "flux", "tig", "stick"];
}

function symptomAliases(symptom: string, extra: string[] = []): string[] {
  const canonical = matchCanonicalInText(symptom);
  const aliasSet = new Set<string>([symptom, ...extra]);
  for (const c of canonical) {
    for (const a of aliasTermsFor(c)) aliasSet.add(a);
  }
  for (const term of expandQueryTerms(symptom)) aliasSet.add(term);
  return [...aliasSet].filter((a) => a.length > 2);
}

function recordsFromTroubleshootingTable(): NormalizedTroubleshootingRecord[] {
  const records: NormalizedTroubleshootingRecord[] = [];

  for (const raw of troubleshootingData as IngestTrouble[]) {
    if (raw.needsReview) continue;
    const symptom = parseProblem(raw);
    if (!symptom) continue;

    const causes = parseNumberedList(raw.possibleCauses);
    const solutions = parseNumberedList(raw.likelySolutions);
    if (causes.length === 0 && solutions.length === 0) continue;

    const safetyPrerequisites =
      /shut off|disconnect.*power|discharge|before adjusting/i.test(symptom + raw.possibleCauses)
        ? [
            "Turn off the welder and disconnect power before servicing the wire feed mechanism.",
          ]
        : [];

    const sourceEvidence: NormalizedTroubleshootingRecord["sourceEvidence"] = [
      {
        source: raw.provenance.source,
        page: raw.provenance.page,
        section: raw.provenance.section,
        excerpt: symptom.slice(0, 200),
      },
    ];
    if (
      raw.provenance.page === 42 &&
      /wire feed|feed roller|bird|wire stop|arc not stable/i.test(symptom)
    ) {
      sourceEvidence.push({
        source: raw.provenance.source,
        page: 43,
        section: "Troubleshooting continuation",
        excerpt: `${symptom} — MIG / flux-cored troubleshooting (pages 42–43)`,
      });
    }

    records.push({
      id: raw.id,
      symptom,
      process: inferProcesses(`${symptom} ${raw.possibleCauses}`, raw.processes),
      possibleCause: causes,
      diagnosticCheck: causes.map((c) => `Check: ${c}`),
      correctiveAction: solutions,
      safetyPrerequisites,
      sourceEvidence,
      visualEvidence: [],
      aliases: symptomAliases(symptom, matchCanonicalInText(symptom)),
    });
  }

  return records;
}

function recordsFromDefectExemplars(): NormalizedTroubleshootingRecord[] {
  return MANUAL_DEFECT_EXEMPLARS.map((ex) => {
    const causes = ex.manualText
      .split(/[;.]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    const canonical = ex.defectCategories[0]?.replace(/_/g, " ") ?? ex.label;
    const symptom = ex.label.replace(/^Wire Weld – /, "").replace(/^Stick Weld – /, "");

    const sourceEvidence: NormalizedTroubleshootingRecord["sourceEvidence"] = [
      {
        source: ex.source,
        page: ex.page,
        section: ex.section,
        assetId: ex.assetId,
        excerpt: ex.manualText.slice(0, 240),
      },
    ];
    if (ex.process === "wire" && ex.page === 37) {
      sourceEvidence.push({
        source: ex.source,
        page: 43,
        section: "Troubleshooting — MIG weld quality",
        excerpt:
          "Cross-check wire feed, shielding gas, polarity, and workpiece cleanliness in the troubleshooting tables on pages 42–43",
      });
    }

    return {
      id: ex.id,
      symptom,
      process: ex.process === "wire" ? ["mig", "flux"] : ex.process === "stick" ? ["stick"] : ["mig", "flux", "stick"],
      materialContext: ex.section,
      possibleCause: causes.length ? causes : [ex.description],
      diagnosticCheck: causes.map((c) => `Inspect for: ${c}`),
      correctiveAction: causes,
      safetyPrerequisites: [],
      sourceEvidence,
      visualEvidence: [
        {
          source: ex.source,
          page: ex.page,
          assetId: ex.assetId,
          caption: ex.label,
        },
      ],
      aliases: symptomAliases(symptom, [
        canonical,
        ex.label,
        ...ex.defectCategories.map((d) => d.replace(/_/g, " ")),
      ]),
    };
  });
}

/** Curated wire-feed procedure records from owner-manual setup sections. */
function recordsFromWireFeedProcedures(): NormalizedTroubleshootingRecord[] {
  return [
    {
      id: "wire-feed-roller-change-p12",
      symptom: "Change feed roller for wire diameter",
      process: ["mig", "flux"],
      possibleCause: ["Incorrect feed roller size or groove for wire diameter"],
      diagnosticCheck: [
        "Check feed roller groove matches spool wire diameter",
        "Confirm solid-core V-groove vs flux-cored knurled roller",
      ],
      correctiveAction: [
        "Unscrew the Feed Roller Knob counterclockwise",
        "Remove the Feed Roller Knob to expose the Feed Roller",
        "Flip or replace the Feed Roller for the wire type and diameter",
        "Screw the Feed Roller Knob back to secure the drive roll",
      ],
      safetyPrerequisites: [
        "Turn OFF power and unplug the welder before opening the door.",
      ],
      sourceEvidence: [
        {
          source: "owner-manual.pdf",
          page: 12,
          section: "Feed Roller Instructions",
          excerpt: "Flip or replace the Feed Roller as needed for wire diameter",
        },
        {
          source: "owner-manual.pdf",
          page: 17,
          section: "Wire feed setup",
          excerpt: "Refer to Feed Roller instructions when changing drive rolls",
        },
      ],
      visualEvidence: [
        {
          source: "owner-manual.pdf",
          page: 12,
          caption: "Feed Roller groove selection diagram",
        },
      ],
      aliases: symptomAliases("feed roller drive roll", [
        "drive roll",
        "drive rolls",
        "change wire drive rolls",
        "wire diameter",
        "feed roller",
        "flip roll",
      ]),
    },
    {
      id: "wire-feed-tension-adjust-p17",
      symptom: "Adjust wire feed tension",
      process: ["mig", "flux"],
      possibleCause: ["Wire feed tension too low or too high"],
      diagnosticCheck: [
        "Feed wire against wood 2–3 inches from gun and observe bend vs stop",
        "Check Feed Tensioner knob setting",
      ],
      correctiveAction: [
        "Press Trigger to feed wire against wood from 2 to 3 inches away",
        "If wire stops instead of bending, tighten Feed Tensioner clockwise",
        "If wire bends from feed pressure, tension is set properly",
        "Use tension 3–5 for solid wire and 2–3 for flux-cored wire",
      ],
      safetyPrerequisites: [
        "Turn OFF the Power Switch and unplug before adjusting tension.",
      ],
      sourceEvidence: [
        {
          source: "owner-manual.pdf",
          page: 17,
          section: "Step 27 — drive tension",
          excerpt: "To check the wire's drive tension, press and hold Trigger",
        },
        {
          source: "owner-manual.pdf",
          page: 9,
          section: "Interior Controls",
          excerpt: "Feed Tensioner on wire feed mechanism",
        },
      ],
      visualEvidence: [],
      aliases: symptomAliases("wire feed tension", [
        "tension",
        "feed tensioner",
        "wire feed pressure",
        "drive-roll pressure",
        "adjust tension",
      ]),
    },
    {
      id: "wire-liner-service-p16",
      symptom: "MIG gun liner clogged or needs replacement",
      process: ["mig", "flux"],
      possibleCause: [
        "Gun liner is clogged or worn",
        "Gun liner is too small for welding wire being used",
        "Damaged MIG gun, cable, or liner assembly",
      ],
      diagnosticCheck: [
        "Check gun liner for obstruction during cold wire feed",
        "Verify liner size matches welding wire diameter",
      ],
      correctiveAction: [
        "Straighten gun cable before feeding wire",
        "Push the wire liner back into the gun if it emerges during feeding",
        "Replace damaged liner — have a qualified technician inspect if needed",
        "Follow Feed Roller and tension steps on pages 12 and 17 after liner service",
      ],
      safetyPrerequisites: [
        "Turn OFF and unplug the welder before servicing the gun liner.",
      ],
      sourceEvidence: [
        {
          source: "owner-manual.pdf",
          page: 16,
          section: "Cold wire feed / liner",
          excerpt: "The wire liner may come out with the welding wire",
        },
        {
          source: "owner-manual.pdf",
          page: 42,
          section: "Troubleshooting — MIG / Flux-Cored",
          excerpt: "Damaged MIG Gun, cable, or liner assembly",
        },
        {
          source: "owner-manual.pdf",
          page: 17,
          section: "Wire feed setup",
          excerpt: "Follow wire feed setup after liner or gun service",
        },
      ],
      visualEvidence: [],
      aliases: symptomAliases("replace MIG liner", [
        "liner",
        "gun liner",
        "mig liner",
        "wire liner",
        "replace liner",
        "liner assembly",
      ]),
    },
    {
      id: "wire-slip-drive-rolls-p42",
      symptom: "Wire slipping in drive rolls",
      process: ["mig", "flux"],
      possibleCause: [
        "Insufficient wire feed pressure",
        "Incorrect wire feed roller size",
        "Feed Tensioner is too tight",
        "Wire not making contact with feed rollers",
      ],
      diagnosticCheck: [
        "Check drive roll groove matches wire diameter",
        "Verify feed tension using step 27 on page 17",
      ],
      correctiveAction: [
        "Increase wire feed pressure properly — follow step 27 on page 17",
        "Flip drive roll to correct size — follow Feed Roller instructions on page 12",
        "Loosen Feed Tensioner so it prevents spinning after trigger release",
      ],
      safetyPrerequisites: [
        "Shut off the welder and disconnect power before adjusting wire feed components.",
      ],
      sourceEvidence: [
        {
          source: "owner-manual.pdf",
          page: 42,
          section: "Troubleshooting — MIG / Flux-Cored",
        },
        {
          source: "owner-manual.pdf",
          page: 43,
          section: "Troubleshooting continuation",
          excerpt: "Wire feed and arc troubleshooting",
        },
        {
          source: "owner-manual.pdf",
          page: 17,
          section: "Feed tension check",
        },
      ],
      visualEvidence: [],
      aliases: symptomAliases("wire slipping drive rolls", [
        "wire slip",
        "slipping in drive rolls",
        "inconsistent feed",
        "drive roll",
        "feed roller",
        "wire feed pressure",
      ]),
    },
  ];
}

export function buildSearchText(record: NormalizedTroubleshootingRecord): string {
  return [
    record.symptom,
    record.materialContext ?? "",
    ...record.aliases,
    ...record.possibleCause,
    ...record.diagnosticCheck,
    ...record.correctiveAction,
    ...record.safetyPrerequisites,
    ...record.sourceEvidence.map((e) => `${e.section ?? ""} ${e.excerpt ?? ""} page ${e.page}`),
    ...record.visualEvidence.map((v) => v.caption ?? ""),
    record.process.join(" "),
    "troubleshooting defect weld diagnosis",
  ]
    .filter(Boolean)
    .join(" ");
}

let cached: NormalizedTroubleshootingRecord[] | null = null;

export function getNormalizedTroubleshootingRecords(): NormalizedTroubleshootingRecord[] {
  if (cached) return cached;

  const byId = new Map<string, NormalizedTroubleshootingRecord>();
  for (const record of [
    ...recordsFromTroubleshootingTable(),
    ...recordsFromDefectExemplars(),
    ...recordsFromWireFeedProcedures(),
  ]) {
    if (!byId.has(record.id)) byId.set(record.id, record);
  }

  cached = [...byId.values()];
  return cached;
}

export function resetTroubleshootingRecordsCache(): void {
  cached = null;
}

export function findRecordsMatchingQuery(query: string): NormalizedTroubleshootingRecord[] {
  const terms = expandQueryTerms(query);
  return getNormalizedTroubleshootingRecords().filter((record) => {
    const haystack = buildSearchText(record).toLowerCase();
    return terms.some((t) => haystack.includes(t));
  });
}
