import type { AgentIntent } from "@/lib/agent/schemas";
import type { MachineState, WeldMode } from "@/lib/schemas/conversation";

const SAFETY_PATTERN =
  /\b(shock|electrocution|explosion|fire|ventilation|ppe|danger|caution|warning|unsafe|injury|death|without a face shield|without gloves)\b/i;
const CALC_PATTERN = /\b(duty cycle|duty-cycle|how long can i weld|rest period|overheat)\b/i;
const SETTINGS_PATTERN =
  /\b(setting|voltage|wire speed|wfs|scf|thickness|material|selection chart)\b/i;
const PART_PATTERN =
  /\b(what is the|what does the|identify|contact tip|nozzle|tensioner|idler|drive roll|ground clamp|torch|electrode holder|socket|knob|lcd|front panel)\b/i;
const VISUAL_PATTERN = /\b(photo|picture|image|uploaded|looks like|this weld)\b/i;
const TROUBLE_PATTERN =
  /\b(problem|wrong|issue|troubleshoot|porosity|spatter|burn.?through|defect|not working|arc does not)\b/i;
const SETUP_PATTERN =
  /\b(setup|set up|connect|install|polarity|wire feed|gas hose|spool)\b/i;

export function classifyIntent(
  message: string,
  mode: WeldMode,
  machineState?: Partial<MachineState>,
): AgentIntent {
  if (SAFETY_PATTERN.test(message)) return "safety_critical";
  if (CALC_PATTERN.test(message)) return "calculation";

  if (mode === "settings" || SETTINGS_PATTERN.test(message)) return "settings";

  if (PART_PATTERN.test(message) && mode !== "setup") return "part_identification";

  if (mode === "setup" || SETUP_PATTERN.test(message)) return "setup";

  if (VISUAL_PATTERN.test(message)) return "visual_diagnosis";

  if (mode === "diagnose" || TROUBLE_PATTERN.test(message)) return "troubleshooting";

  if (PART_PATTERN.test(message)) return "part_identification";

  if (machineState?.symptoms?.length) return "troubleshooting";

  return "manual_question";
}

export function intentLabel(intent: AgentIntent): string {
  const labels: Record<AgentIntent, string> = {
    setup: "welder setup",
    troubleshooting: "troubleshooting",
    settings: "settings recommendation",
    calculation: "duty-cycle calculation",
    part_identification: "part / control identification",
    manual_question: "manual lookup",
    visual_diagnosis: "visual weld diagnosis",
    safety_critical: "safety-critical guidance",
  };
  return labels[intent];
}

/**
 * Deterministic clarification for genuinely empty/near-empty input.
 * The richer three-level policy (information / configuration / safety)
 * lives in @/lib/agent/clarification-policy and is used by the runner.
 */
export function immediateClarificationQuestion(message: string): string | null {
  const text = message.trim();
  if (!text || /^[?\s!@#.\-_/\\]+$/.test(text) || text.length < 4) {
    return "What do you need help with on the OmniPro 220 — setup, settings, duty cycle, or a welding problem?";
  }
  return null;
}
