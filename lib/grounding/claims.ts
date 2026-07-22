import type { Citation } from "@/lib/schemas/conversation";
import type { ClaimKind, EvidenceLevel, ExtractedClaim } from "@/lib/grounding/schemas";

const NUMERIC_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(?:A\b|amps?\b|V\b|volts?\b|%\s*(?:duty|@)|IPM\b|ipm\b|inch(?:es)?\b|mm\b|\/\d+)/gi;

const MACHINE_PATTERNS: Array<{ pattern: RegExp; kind: ClaimKind }> = [
  { pattern: /\bDCEP\b|\bDCEN\b|electrode positive|electrode negative/gi, kind: "machine" },
  { pattern: /ground clamp|positive socket|negative socket|wire feed power/gi, kind: "machine" },
  { pattern: /\b(?:MIG|flux[- ]?core|TIG|stick|solid core)\b/gi, kind: "configuration" },
  { pattern: /\b120\s*V|\b240\s*V/gi, kind: "configuration" },
  { pattern: /C25|argon|shielding gas|flux[- ]?self/gi, kind: "configuration" },
];

const VISUAL_CERTAINTY_PATTERN =
  /\b(confirmed|definitely|certainly|guaranteed|root cause is|repair is complete|proven to be)\b/gi;

const DANGEROUS_ACTION_PATTERN =
  /\b(open the door|main pcb|control pcb|interior|while powered|still powered|without unplug|without disconnect|bypass|live voltage|energized)\b/gi;

let claimCounter = 0;

function nextId(): string {
  claimCounter += 1;
  return `claim-${claimCounter}`;
}

export function resetClaimCounter(): void {
  claimCounter = 0;
}

function citationCorpus(citations: Citation[]): string {
  return citations
    .map((c) => `${c.source} ${c.page} ${c.section ?? ""} ${c.excerpt ?? ""}`)
    .join(" ")
    .toLowerCase();
}

function toolCorpus(toolSummaries: string[]): string {
  return toolSummaries.join(" ").toLowerCase();
}

function matchEvidenceLevel(
  claimText: string,
  citations: Citation[],
  toolSummaries: string[],
): { level: EvidenceLevel; citationKey?: string } {
  const lower = claimText.toLowerCase();
  const tools = toolCorpus(toolSummaries);

  if (/calculate_duty_cycle|duty cycle|applicabledutypercent/i.test(tools)) {
    const ampMatch = lower.match(/(\d+)\s*a/);
    if (ampMatch && tools.includes(ampMatch[1]!)) {
      return { level: "calculated" };
    }
    if (/duty/i.test(lower) && /duty/i.test(tools)) {
      return { level: "calculated" };
    }
  }

  if (/validate_machine_configuration|required_setup/i.test(tools) && /polarity|process|consumable/i.test(lower)) {
    return { level: "indirect" };
  }

  for (const c of citations) {
    const blob = `${c.excerpt ?? ""} ${c.section ?? ""}`.toLowerCase();
    const key = `${c.source}:${c.page}`;
    const nums = lower.match(/\d+(?:\.\d+)?/g) ?? [];
    const hasNum = nums.some((n) => blob.includes(n));
    const words = lower.split(/\s+/).filter((w) => w.length > 3);
    const wordHits = words.filter((w) => blob.includes(w)).length;

    if (hasNum && wordHits >= 1) return { level: "direct", citationKey: key };
    if (wordHits >= 2 || (words.length <= 2 && wordHits >= 1)) {
      return { level: "direct", citationKey: key };
    }
    if (blob.length > 10 && wordHits >= 1) return { level: "indirect", citationKey: key };
  }

  // Short numeric claims (e.g. "200A", "240V") can match citation numbers directly
  const compactNums = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:a|v)\b/g);
  if (compactNums) {
    for (const c of citations) {
      const blob = `${c.excerpt ?? ""} ${c.section ?? ""}`.toLowerCase();
      const key = `${c.source}:${c.page}`;
      if (compactNums.some((token) => {
        const n = token.match(/\d+(?:\.\d+)?/)?.[0];
        return n && blob.includes(n);
      })) {
        return { level: "direct", citationKey: key };
      }
    }
  }

  return { level: "unsupported" };
}

export function extractClaims(
  answer: string,
  citations: Citation[],
  toolSummaries: string[],
  intent?: string,
): ExtractedClaim[] {
  resetClaimCounter();
  const claims: ExtractedClaim[] = [];
  const seen = new Set<string>();

  const addClaim = (text: string, kind: ClaimKind) => {
    const key = `${kind}:${text.toLowerCase().trim()}`;
    if (seen.has(key) || text.trim().length < 2) return;
    seen.add(key);
    const { level, citationKey } = matchEvidenceLevel(text, citations, toolSummaries);
    claims.push({
      id: nextId(),
      text: text.trim(),
      kind,
      evidenceLevel: level,
      citationKey,
    });
  };

  let match: RegExpExecArray | null;
  const numRe = new RegExp(NUMERIC_PATTERN.source, NUMERIC_PATTERN.flags);
  while ((match = numRe.exec(answer)) !== null) {
    const start = Math.max(0, match.index - 20);
    const end = Math.min(answer.length, match.index + match[0].length + 30);
    addClaim(answer.slice(start, end).replace(/\s+/g, " ").trim(), "numeric");
  }

  for (const { pattern, kind } of MACHINE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(answer)) !== null) {
      const start = Math.max(0, match.index - 15);
      const end = Math.min(answer.length, match.index + match[0].length + 40);
      addClaim(answer.slice(start, end).replace(/\s+/g, " ").trim(), kind);
    }
  }

  if (intent === "visual_diagnosis" || VISUAL_CERTAINTY_PATTERN.test(answer)) {
    const re = new RegExp(VISUAL_CERTAINTY_PATTERN.source, VISUAL_CERTAINTY_PATTERN.flags);
    while ((match = re.exec(answer)) !== null) {
      addClaim(match[0], "visual");
    }
  }

  if (DANGEROUS_ACTION_PATTERN.test(answer)) {
    const re = new RegExp(DANGEROUS_ACTION_PATTERN.source, DANGEROUS_ACTION_PATTERN.flags);
    while ((match = re.exec(answer)) !== null) {
      const start = Math.max(0, match.index - 10);
      const end = Math.min(answer.length, match.index + match[0].length + 50);
      addClaim(answer.slice(start, end).replace(/\s+/g, " ").trim(), "procedural");
    }
  }

  return claims;
}

export function detectPolarityConflict(answer: string, citations: Citation[]): string[] {
  const conflicts: string[] = [];
  const lower = answer.toLowerCase();
  const hasFlux = /flux/i.test(lower);
  const hasMigSolid = /mig solid|solid core|gas.shielded/i.test(lower);

  if (hasFlux && /\bDCEP\b/i.test(answer)) {
    conflicts.push("Flux-core typically requires DCEN per owner-manual.pdf p.13 — answer mentions DCEP.");
  }
  if (hasMigSolid && /\bDCEN\b/i.test(answer) && !/tig/i.test(lower)) {
    conflicts.push("MIG solid core typically requires DCEP per owner-manual.pdf p.14 — answer mentions DCEN.");
  }

  const corpus = citationCorpus(citations);
  if (/dcep/i.test(lower) && /dcen/i.test(corpus) && !/tig/i.test(lower)) {
    conflicts.push("Answer and citations disagree on polarity type.");
  }

  return conflicts;
}

export function detectVoltageConflict(answer: string): string[] {
  const has120 = /\b120\s*V/i.test(answer);
  const has240 = /\b240\s*V/i.test(answer);
  const hasClarifier = /\b(depending|either|outlet|your input voltage|which voltage)\b/i.test(answer);
  if (has120 && has240 && !hasClarifier) {
    return ["Answer mixes 120 V and 240 V specifications without clarifying which input is in use."];
  }
  return [];
}

export function detectProcessMix(answer: string): string[] {
  const processes = ["mig", "flux", "tig", "stick"].filter((p) =>
    new RegExp(`\\b${p}\\b`, "i").test(answer),
  );
  if (processes.length > 2) {
    return [`Answer references multiple processes (${processes.join(", ")}) — may mix incompatible setup guidance.`];
  }
  return [];
}

export function detectVisualOverconfidence(answer: string, intent?: string): string[] {
  if (intent !== "visual_diagnosis" && !/photo|image|visual|looks like/i.test(answer)) {
    return [];
  }
  const issues: string[] = [];
  if (VISUAL_CERTAINTY_PATTERN.test(answer)) {
    issues.push("Visual diagnosis must not state certainty — photo evidence alone is insufficient.");
  }
  if (/root cause|confirmed repair|definitely caused by/i.test(answer)) {
    issues.push("Repair or root cause cannot be confirmed from a photo alone.");
  }
  return issues;
}

export function detectDangerousProcedures(
  answer: string,
  safetyNotices: string[],
  userMessage = "",
): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const lower = answer.toLowerCase();
  const user = userMessage.toLowerCase();

  // Block when the *user* asks for interlock bypass or live interior work,
  // even if the model verbally refuses (prevents continuing unsafe dialogue).
  const userRequestsBypass =
    /\bbypass\b/i.test(user) &&
    /\b(interlock|door|safety)\b/i.test(user);
  const userRequestsLiveInterior =
    /\b(main pcb|control pcb|interior|energized)\b/i.test(user) &&
    /\b(while|still|plugged in|powered|live|without (unplug|disconnect))\b/i.test(user);

  if (userRequestsBypass) {
    blockers.push("Cannot recommend bypassing door or safety interlocks.");
  }
  if (userRequestsLiveInterior) {
    blockers.push(
      "Cannot provide guidance for interior/PCB work while the welder is powered or plugged in.",
    );
  }

  const recommendsBypass =
    /\bbypass\b/i.test(lower) &&
    /\binterlock\b/i.test(lower) &&
    !/\b(do not|don't|never|cannot|can't|must not|won't|will not)\b/i.test(lower);
  if (recommendsBypass) {
    blockers.push("Cannot recommend bypassing door or safety interlocks.");
  }

  const dangerous =
    /open the door|main pcb|control pcb|without unplug|without disconnect|while power|still powered|energized part|live voltage/i.test(
      lower,
    );
  // "Open the door" for the settings/selection chart is normal setup — not interior service.
  const doorChartOnly =
    /open the door|inside (of )?the (welder )?door/i.test(lower) &&
    /settings chart|selection chart|door chart|look up|read the (row|chart)/i.test(lower) &&
    !/\b(main pcb|control pcb|bypass|energized|live voltage|while powered|still powered)\b/i.test(
      lower,
    );

  if (dangerous && !doorChartOnly && blockers.length === 0) {
    const powerOffInAnswer =
      /turn off|unplug|disconnect power|disconnect the power|cool down before|de-energiz/i.test(
        lower,
      );
    const isRefusal =
      /\b(cannot|can't|do not|don't|never|must not|won't|will not|refuse)\b/i.test(lower) &&
      /\b(bypass|pcb|interlock|powered|energized)\b/i.test(lower);

    if (isRefusal) {
      // Model refused — still escalate to block when user asked for the unsafe act.
      if (userRequestsBypass || userRequestsLiveInterior) {
        // already handled above
      } else {
        warnings.push("Hazardous maintenance topic — keep power off and follow manual safety sections.");
      }
    } else if (!powerOffInAnswer) {
      blockers.push(
        "Dangerous maintenance or interior work mentioned without required power-off and safety precautions from the manual.",
      );
    } else {
      warnings.push("Procedural guidance involves hazardous work — verify all manual safety steps.");
    }
  }

  if (safetyNotices.length > 0 && dangerous && blockers.length === 0) {
    warnings.push("Safety notices attached — confirm power is off before servicing.");
  }

  void safetyNotices;

  return { blockers, warnings };
}

export function detectOutOfScope(answer: string, userMessage: string): string[] {
  const issues: string[] = [];
  const lower = answer.toLowerCase();
  const msg = userMessage.toLowerCase();

  const REFUSES =
    /(?:out of scope|only (?:covers|supports)|cannot help|can't help|not (?:able|equipped) to|i don't have documentation)/i;

  if (
    /\b(?:lincoln|miller|hobart|esab|fronius|hypertherm)\b/i.test(msg) &&
    !REFUSES.test(lower)
  ) {
    issues.push(
      "Question is about another welder brand — WeldPilot only covers the Vulcan OmniPro 220.",
    );
  } else if (
    /\b(?:lincoln|miller|hobart|esab|fronius|hypertherm)\b/i.test(answer) &&
    !/\bomnipro|57812|harbor freight|vulcan/i.test(answer) &&
    !REFUSES.test(lower)
  ) {
    issues.push("Answer references another welder brand — WeldPilot only covers the Vulcan OmniPro 220.");
  }

  if (
    /\b(?:ibuprofen|aspirin|medication|prescription|antibiotic)\b/i.test(lower) &&
    /(?:arc flash|medical|doctor|physician|injury|burn)/i.test(msg)
  ) {
    issues.push("Medical treatment advice is out of scope — seek professional medical care.");
  }

  if (
    /\b(?:ac balance|ac frequency|pulse settings)\b/i.test(lower) &&
    /aluminum|6061|ac tig/i.test(msg) &&
    !/not in the manual|not documented|out of scope|selection chart/i.test(lower)
  ) {
    issues.push(
      "Advanced AC TIG pulse settings are not documented for this machine — do not invent parameters.",
    );
  }

  return issues;
}

export function detectInventedSettingsClaims(
  answer: string,
  toolSummaries: string[],
): string[] {
  const tools = toolSummaries.join(" ").toLowerCase();
  const hasSettingsTool = /find_settings|settings chart|settingsitems/i.test(tools);
  const inventedNumeric =
    /\b\d{1,2}\s*v\b.*\b\d{2,4}\s*(?:ipm|inches per minute)\b/i.test(answer) ||
    /\bset\s+\d{1,2}\s*v\b/i.test(answer);

  if (inventedNumeric && !hasSettingsTool) {
    return [
      "Specific voltage and wire-speed numbers require door-chart evidence via find_settings — do not invent values.",
    ];
  }
  return [];
}

export function isAmbiguousCableQuestion(message: string): boolean {
  return /which cable|where does.*(clamp|ground|torch|electrode).*go|cable goes where/i.test(message);
}
