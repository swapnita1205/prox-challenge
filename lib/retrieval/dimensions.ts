import type { QueryDimensions } from "@/lib/retrieval/types";
import { normalizeQuery } from "@/lib/retrieval/tokenizer";

const PROCESS_PATTERNS: Array<{ pattern: RegExp; process: string }> = [
  { pattern: /\b(mig|solid[- ]?core|gas[- ]?shielded)\b/i, process: "mig" },
  { pattern: /\b(flux[- ]?core|flux[- ]?cored|gasless)\b/i, process: "flux" },
  { pattern: /\b(tig|gtaw)\b/i, process: "tig" },
  { pattern: /\b(stick|smaw|arc welding)\b/i, process: "stick" },
];

const COMPONENT_PATTERNS: Array<{ pattern: RegExp; component: string }> = [
  { pattern: /\b(front panel|control panel|lcd)\b/i, component: "front panel" },
  { pattern: /\b(wire feed|feed mechanism|tensioner|idler|liner|feed roller|drive roll)\b/i, component: "wire feed" },
  { pattern: /\b(ground clamp|work clamp|workpiece ground)\b/i, component: "ground clamp" },
  { pattern: /\b(contact tip|nozzle)\b/i, component: "contact tip" },
  { pattern: /\b(power switch)\b/i, component: "power switch" },
  { pattern: /\b(electrode holder)\b/i, component: "electrode holder" },
  { pattern: /\b(tig torch)\b/i, component: "tig torch" },
  { pattern: /\b(positive socket|negative socket)\b/i, component: "socket" },
];

const SYMPTOM_PATTERNS: Array<{ pattern: RegExp; symptom: string }> = [
  { pattern: /\b(porosity|porous|pinholes?|gas pockets)\b/i, symptom: "porosity" },
  { pattern: /\b(spatter|splatter|excessive spatter)\b/i, symptom: "spatter" },
  { pattern: /\b(burn[- ]?through|burnthrough|melt through)\b/i, symptom: "burn-through" },
  {
    pattern: /\b(poor penetration|inadequate penetration|lack of fusion|cold lap)\b/i,
    symptom: "penetration",
  },
  {
    pattern: /\b(wire feed|wire does not feed|bird.?nest|wire jam|tangled wire)\b/i,
    symptom: "wire feed",
  },
  {
    pattern: /\b(wire slip|slipping in (the )?drive rolls?|inconsistent feed)\b/i,
    symptom: "wire slip",
  },
];

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string }> = [
  { pattern: /\b(duty cycle|duty-cycle)\b/i, intent: "duty_cycle" },
  { pattern: /\b(polarity|dcep|dcen|socket|cable)\b/i, intent: "polarity" },
  { pattern: /\b(setting|voltage|wire speed|wfs|scf)\b/i, intent: "settings" },
  { pattern: /\b(porosity|defect|troubleshoot|problem|issue|wrong)\b/i, intent: "troubleshooting" },
  { pattern: /\b(setup|set up|connect|install)\b/i, intent: "setup" },
  { pattern: /\b(warning|caution|danger|safety|ppe)\b/i, intent: "safety" },
  { pattern: /\b(diagram|figure|image|chart|panel)\b/i, intent: "visual" },
  { pattern: /\b(tension|feed roller|drive roll|liner|spool)\b/i, intent: "wire_feed" },
];

export function extractQueryDimensions(query: string): QueryDimensions {
  const q = normalizeQuery(query);
  const processes = new Set<string>();
  let inputVoltage: 120 | 240 | undefined;
  let outputAmps: number | undefined;
  let material: string | undefined;
  let thickness: string | undefined;
  let wireType: string | undefined;
  let wireDiameter: string | undefined;
  let shieldingGas: string | undefined;
  let polarity: string | undefined;
  let symptom: string | undefined;
  let component: string | undefined;
  let safetyRelevant = false;
  const intents: string[] = [];

  for (const { pattern, process } of PROCESS_PATTERNS) {
    if (pattern.test(q)) processes.add(process);
  }

  const voltMatch = q.match(/\b(120|240)\s*v/i);
  if (voltMatch) inputVoltage = parseInt(voltMatch[1]!, 10) as 120 | 240;

  const ampMatch = q.match(/\b(\d{2,3})\s*a(?:mp)?s?\b/i);
  if (ampMatch) outputAmps = parseInt(ampMatch[1]!, 10);

  if (/\b(mild steel|stainless|aluminum|chrome moly)\b/i.test(q)) {
    const m = q.match(/\b(mild steel|stainless(?:\s+steel)?|aluminum|chrome moly)\b/i);
    material = m?.[1];
  }

  if (/(\d+\/\d+|\d+(?:\.\d+)?)\s*["']?\s*(inch|inches|in|mm)?\b/i.test(q)) {
    const t = q.match(/(\d+\/\d+|\d+(?:\.\d+)?)\s*["']?\s*(?:inch|inches|in|mm)?/i);
    thickness = t?.[0]?.trim();
  }

  if (/\beighth[- ]?inch\b/i.test(q)) thickness = "1/8 inch";
  if (/\bquarter[- ]?inch\b/i.test(q) && !thickness) thickness = "1/4 inch";

  if (/\b(solid[- ]?core|flux[- ]?core)\b/i.test(q)) {
    wireType = /flux/i.test(q) ? "flux-cored" : "solid";
  }

  if (/\b\.?0?25|\.?030|\.?035|\.?045\b/.test(q)) {
    const w = q.match(/\.?0?25|\.?030|\.?035|\.?045/);
    wireDiameter = w?.[0];
  }

  if (/\b(argon|c25|co2|shielding gas)\b/i.test(q)) {
    const g = q.match(/\b(argon|c25|co2|shielding gas)\b/i);
    shieldingGas = g?.[1];
  }

  if (/\b(dcep|dcen|electrode positive|electrode negative)\b/i.test(q)) {
    polarity = /dcen/i.test(q) ? "DCEN" : /dcep/i.test(q) ? "DCEP" : "polarity";
  } else if (/polarity/i.test(q)) {
    polarity = "polarity";
  }

  for (const { pattern, component: c } of COMPONENT_PATTERNS) {
    if (pattern.test(q)) component = c;
  }

  for (const { pattern, symptom: s } of SYMPTOM_PATTERNS) {
    if (pattern.test(q)) symptom = s;
  }

  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(q)) intents.push(intent);
  }

  if (intents.includes("safety") || /\b(warning|caution|danger|ppe|safety)\b/i.test(q)) {
    safetyRelevant = true;
  }

  return {
    processes: [...processes],
    inputVoltage,
    outputAmps,
    material,
    thickness,
    wireType,
    wireDiameter,
    shieldingGas,
    polarity,
    symptom,
    component,
    safetyRelevant,
    intents: [...new Set(intents)],
  };
}
