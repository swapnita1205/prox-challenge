import { expandQueryTerms } from "@/lib/troubleshooting";

const EXPANSIONS: Record<string, string[]> = {
  mig: ["mig", "solid core", "gas shielded", "wire feed", "dcep", "shielding gas", "c25"],
  flux: ["flux", "flux-cored", "gasless", "dcen", "wire feed"],
  tig: ["tig", "argon", "tig torch", "foot pedal", "filler rod", "dcen", "torch"],
  stick: ["stick", "electrode", "electrode holder", "slag", "dcep"],
  polarity: ["polarity", "socket", "ground clamp", "cable", "positive", "negative", "dcep", "dcen"],
  porosity: ["porosity", "cavities", "holes", "shielding gas", "polarity", "dirty workpiece", "ctwd"],
  "duty cycle": ["duty cycle", "rated", "continuous", "amps", "overheat", "rest period"],
  "wire feed": ["wire feed", "tensioner", "idler arm", "drive roll", "tension", "feed speed"],
  "ground clamp": ["ground clamp", "work clamp", "workpiece", "ground cable", "socket"],
  "front panel": ["front panel", "lcd display", "control knob", "home button", "power switch", "socket"],
  settings: ["settings", "voltage", "wire speed", "selection chart", "material", "thickness"],
  safety: ["warning", "caution", "danger", "ppe", "electric shock", "safety"],
};

export function expandQuery(query: string, processes: string[] = []): string {
  const terms = new Set(expandQueryTerms(query));

  for (const [key, synonyms] of Object.entries(EXPANSIONS)) {
    if (query.toLowerCase().includes(key) || synonyms.some((s) => query.toLowerCase().includes(s))) {
      for (const s of synonyms) terms.add(s);
    }
  }

  for (const p of processes) {
    const syns = EXPANSIONS[p];
    if (syns) for (const s of syns) terms.add(s);
  }

  return [...terms].join(" ");
}

export function expandForIntent(intent: string, baseQuery: string, processes: string[]): string {
  const intentExpansions: Record<string, string[]> = {
    duty_cycle: ["duty cycle", "rated", "continuous", "specifications", ...processes],
    polarity: ["polarity", "socket", "ground clamp", "cable", "setup", ...processes],
    settings: ["settings", "voltage", "wire speed", "selection chart", "material"],
    troubleshooting: ["troubleshooting", "problem", "cause", "solution", "defect"],
    setup: ["setup", "connect", "install", "procedure", ...processes],
    safety: ["warning", "caution", "danger", "safety", "ppe", "injury"],
    visual: ["diagram", "figure", "panel", "chart", "image"],
    wire_feed: ["wire feed", "tensioner", "tension", "idler", "drive roll"],
  };

  const extra = intentExpansions[intent] ?? [];
  return expandQuery(`${baseQuery} ${extra.join(" ")}`, processes);
}
