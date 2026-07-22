/** Domain synonym groups for welding troubleshooting and wire-feed retrieval. */
export const DOMAIN_SYNONYMS: Record<string, string[]> = {
  porosity: ["porosity", "pinholes", "gas pockets", "porous", "cavities", "holes in bead"],
  spatter: ["spatter", "excessive spatter", "splatter", "grainy spatter", "large spatter"],
  "burn-through": [
    "burn-through",
    "burn through",
    "burnthrough",
    "melt through",
    "hole in weld",
    "thin sheet burn",
  ],
  penetration: [
    "lack of fusion",
    "cold lap",
    "inadequate penetration",
    "poor penetration",
    "lack of penetration",
  ],
  "wire feed": [
    "wire feed",
    "wire feeding",
    "wire does not feed",
    "wire won't feed",
    "feed problem",
    "inconsistent feed",
  ],
  "wire slip": [
    "wire slip",
    "wire slipping",
    "slipping in drive rolls",
    "slips in the rollers",
    "feed roller slip",
  ],
  birdnesting: ["birdnesting", "bird nest", "bird's nest", "wire jam", "tangled wire", "nested wire"],
  "drive roll": [
    "drive roll",
    "drive rolls",
    "feed roller",
    "feed rollers",
    "wire feed roller",
    "roller groove",
  ],
  tension: [
    "wire tension",
    "feed tension",
    "drive tension",
    "tensioner",
    "feed tensioner",
    "drive-roll pressure",
    "wire feed pressure",
  ],
  liner: ["liner", "gun liner", "mig liner", "wire liner", "replace liner", "liner assembly"],
  "contact tip": ["contact tip", "tip blockage", "blocked tip", "contact-tip"],
  "ground clamp": ["ground clamp", "work clamp", "workpiece ground", "ground cable"],
  "flux core": ["flux core", "flux-core", "flux cored", "self-shielded flux core", "gasless flux core"],
  "gas-shielded": ["gas shielded", "gas-shielded", "solid core", "mig solid", "shielding gas"],
};

const TERM_TO_CANONICAL = new Map<string, string>();
for (const [canonical, terms] of Object.entries(DOMAIN_SYNONYMS)) {
  for (const term of terms) {
    TERM_TO_CANONICAL.set(term.toLowerCase(), canonical);
  }
  TERM_TO_CANONICAL.set(canonical.toLowerCase(), canonical);
}

export function resolveCanonicalTerm(term: string): string | null {
  const lower = term.toLowerCase().trim();
  if (TERM_TO_CANONICAL.has(lower)) return TERM_TO_CANONICAL.get(lower)!;
  for (const [alias, canonical] of TERM_TO_CANONICAL) {
    if (lower.includes(alias) || alias.includes(lower)) return canonical;
  }
  return null;
}

export function aliasTermsFor(canonical: string): string[] {
  return DOMAIN_SYNONYMS[canonical] ?? [canonical];
}

export function expandQueryTerms(query: string): string[] {
  const lower = query.toLowerCase();
  const terms = new Set(
    lower
      .replace(/[^\w\s%.-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );

  for (const [canonical, aliases] of Object.entries(DOMAIN_SYNONYMS)) {
    if (aliases.some((a) => lower.includes(a)) || lower.includes(canonical)) {
      for (const a of aliases) terms.add(a.replace(/\s+/g, " "));
      terms.add(canonical);
    }
  }

  return [...terms];
}

export function matchCanonicalInText(text: string): string[] {
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  for (const [canonical, aliases] of Object.entries(DOMAIN_SYNONYMS)) {
    if (aliases.some((a) => lower.includes(a))) matched.add(canonical);
  }
  return [...matched];
}
