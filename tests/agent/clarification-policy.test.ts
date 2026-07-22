import { describe, expect, it } from "vitest";
import {
  buildClarifyingQuestion,
  buildConfigurationClarificationAnswer,
  buildConfigurationClarificationResponse,
  buildSafetyBlockedResponse,
  clarificationLevel,
  missingFieldReasons,
  optionalFollowUp,
  requiredMissingFields,
  shouldRequireClarification,
  type ClarificationPolicyInput,
} from "@/lib/agent/clarification-policy";

function input(message: string, overrides: Partial<ClarificationPolicyInput> = {}): ClarificationPolicyInput {
  return {
    message,
    intent: "manual_question",
    ...overrides,
  };
}

describe("ClarificationPolicy — information requests", () => {
  const informationCases: Array<[string, ClarificationPolicyInput["intent"]]> = [
    ["Show me the front panel.", "part_identification"],
    ["Show me the wiring diagram.", "manual_question"],
    // "wire feed" overlaps with setup vocabulary — must still resolve to information.
    ["Show me the wire feed mechanism.", "setup"],
    ["What does this knob do?", "part_identification"],
    ["Explain this schematic.", "manual_question"],
    ["Show me the weld diagnosis examples.", "troubleshooting"],
    ["What does the duty cycle mean?", "calculation"],
  ];

  it.each(informationCases)("classifies %j as information, never blocking", (message, intent) => {
    const policyInput = input(message, { intent });
    expect(clarificationLevel(policyInput)).toBe("information");
    expect(shouldRequireClarification(policyInput)).toBe(false);
    expect(requiredMissingFields(policyInput)).toEqual([]);
  });

  it("answers duty cycle immediately even in setup mode intent overlap", () => {
    const policyInput = input("What does the duty cycle mean?", { intent: "setup" });
    expect(clarificationLevel(policyInput)).toBe("information");
    expect(shouldRequireClarification(policyInput)).toBe(false);
  });

  it("offers one optional, non-blocking follow-up when process is unknown", () => {
    const followUp = optionalFollowUp(input("Show me the front panel.", { intent: "part_identification" }));
    expect(followUp).toMatch(/MIG|TIG|Stick|Flux-Core/);
  });

  it("skips the optional follow-up once the process is already known", () => {
    const followUp = optionalFollowUp(
      input("Show me the wire feed mechanism for TIG.", { intent: "setup" }),
    );
    expect(followUp).toBeNull();
  });

  it("never exposes internal state labels in information-level copy", () => {
    const followUp = optionalFollowUp(input("Show me the front panel.", { intent: "part_identification" }));
    const text = `${followUp ?? ""}`;
    expect(text).not.toMatch(/clarification required/i);
    expect(text).not.toMatch(/missing parameter/i);
    expect(text).not.toMatch(/grounding status/i);
    expect(text).not.toMatch(/internal routing/i);
  });
});

describe("ClarificationPolicy — configuration requests", () => {
  it("requires the welding process for a polarity question", () => {
    const policyInput = input("What polarity should I use?", { intent: "setup" });
    expect(clarificationLevel(policyInput)).toBe("configuration");
    expect(shouldRequireClarification(policyInput)).toBe(true);
    expect(requiredMissingFields(policyInput)).toEqual(["process"]);
  });

  it("does not ask again once the process is already stated", () => {
    const policyInput = input("What polarity should I use for TIG?", { intent: "setup" });
    expect(requiredMissingFields(policyInput)).toEqual([]);
    expect(shouldRequireClarification(policyInput)).toBe(false);
  });

  it("requires process, material, and thickness for a bare settings request", () => {
    const policyInput = input("What settings should I use?", { intent: "settings" });
    expect(clarificationLevel(policyInput)).toBe("configuration");
    const fields = requiredMissingFields(policyInput);
    expect(fields).toEqual(["process", "material", "thickness"]);
  });

  it("only asks for material and thickness once the process is known", () => {
    const policyInput = input("Configure MIG settings.", {
      intent: "settings",
      machineState: { process: "mig" },
    });
    expect(requiredMissingFields(policyInput)).toEqual(["material", "thickness"]);
  });

  it("does not require anything once machineState already has process, material, thickness", () => {
    const policyInput = input("What settings should I use?", {
      intent: "settings",
      machineState: { process: "mig", material: "steel", thickness: '1/8"' },
    });
    expect(requiredMissingFields(policyInput)).toEqual([]);
    expect(shouldRequireClarification(policyInput)).toBe(false);
  });

  it("requires only process for a generic 'set the machine up' request", () => {
    const policyInput = input("Set the machine up.", { intent: "setup" });
    expect(clarificationLevel(policyInput)).toBe("configuration");
    expect(requiredMissingFields(policyInput)).toEqual(["process"]);
  });

  it("'configure MIG'/'configure TIG' already name the process, so nothing is missing", () => {
    expect(requiredMissingFields(input("Configure MIG.", { intent: "setup" }))).toEqual([]);
    expect(requiredMissingFields(input("Configure TIG.", { intent: "setup" }))).toEqual([]);
    // Process named in-message satisfies the requirement without machineState.
  });

  it("requires process for an ambiguous cable routing question", () => {
    const policyInput = input("Which cable goes where?", { intent: "setup" });
    expect(clarificationLevel(policyInput)).toBe("configuration");
    expect(requiredMissingFields(policyInput)).toEqual(["process"]);
    expect(missingFieldReasons(["process"])[0]).toMatch(/process|cable/i);
  });

  it("requires the welding process for a bare voltage question", () => {
    const policyInput = input("What voltage should I use?", { intent: "settings" });
    expect(requiredMissingFields(policyInput)).toContain("process");
  });

  it("recognizes an unsupported material as 'material stated' — does not re-ask what the user already answered", () => {
    // Regression: titanium isn't a manual-supported material, but the user
    // did name a material. The clarification gate should only ask about
    // material when NONE was given; whether it's supported is a downstream
    // grounding/resolveSettings concern, not this pre-model gate.
    const policyInput = input(
      "Give me exact MIG voltage and WFS for 3/8 inch titanium on 480V three-phase.",
      { intent: "settings" },
    );
    expect(requiredMissingFields(policyInput)).toEqual([]);
    expect(shouldRequireClarification(policyInput)).toBe(false);
  });

  it("builds a conversational multiple-choice question when process is missing", () => {
    const answer = buildConfigurationClarificationAnswer(["process"]);
    expect(answer).toMatch(/I can help configure the machine/);
    expect(answer).toMatch(/MIG/);
    expect(answer).toMatch(/Flux-Core/);
    expect(answer).toMatch(/TIG/);
    expect(answer).toMatch(/Stick/);
    expect(answer).not.toMatch(/clarification required/i);
  });

  it("builds a natural follow-up question when only material/thickness are missing", () => {
    const answer = buildConfigurationClarificationAnswer(["material", "thickness"]);
    expect(answer).toMatch(/material/i);
    expect(answer).toMatch(/thickness/i);
    expect(answer).not.toMatch(/clarification required/i);
    expect(answer).not.toMatch(/missing parameter/i);
  });

  it("never generates a settings/polarity recommendation while fields are missing", () => {
    const response = buildConfigurationClarificationResponse("settings", ["process", "material", "thickness"]);
    expect(response.answer).not.toMatch(/\bDCEP\b|\bDCEN\b/);
    expect(response.answer).not.toMatch(/\d+\s*(?:V|amps?|IPM)\b/i);
    // The question is asked conversationally inside `answer` itself, so
    // `clarifyingQuestion` is left null to avoid a duplicate "one question
    // that would help" line being appended underneath it.
    expect(response.answer).toMatch(/which welding process/i);
    expect(response.clarifyingQuestion).toBeNull();
    expect(response.citations).toEqual([]);
  });

  it("buildClarifyingQuestion prioritizes process over other fields", () => {
    expect(buildClarifyingQuestion(["process", "material"])).toMatch(/process/i);
    expect(buildClarifyingQuestion(["material", "thickness"])).toMatch(/material|thickness/i);
    expect(buildClarifyingQuestion([])).toBe("");
  });
});

describe("ClarificationPolicy — safety-critical requests", () => {
  const safetyMessages = ["Bypass safety.", "Live electrical work.", "Dangerous maintenance."];

  it.each(safetyMessages)("classifies %j as safety and blocks immediately", (message) => {
    const policyInput = input(message, { intent: "manual_question" });
    expect(clarificationLevel(policyInput)).toBe("safety");
    // Safety is a block, not a clarification request.
    expect(shouldRequireClarification(policyInput)).toBe(false);
  });

  it("blocks regardless of the classified intent when the message itself is unsafe", () => {
    const policyInput = input("Show me how to bypass the door safety interlock.", {
      intent: "part_identification",
    });
    expect(clarificationLevel(policyInput)).toBe("safety");
  });

  it("builds a firm but conversational refusal with no internal jargon", () => {
    const response = buildSafetyBlockedResponse();
    expect(response.intent).toBe("safety_critical");
    expect(response.answer).not.toMatch(/clarification required/i);
    expect(response.answer).not.toMatch(/missing parameter/i);
    expect(response.answer).not.toMatch(/grounding status/i);
    expect(response.answer).not.toMatch(/internal routing/i);
    expect(response.clarifyingQuestion).toBeNull();
  });
});
