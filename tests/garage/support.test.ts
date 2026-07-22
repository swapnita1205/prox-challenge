import { describe, expect, it } from "vitest";
import {
  buildSpeakText,
  detectVoiceCapabilities,
  getVoiceSupportNotice,
  resolveMismatchResponse,
  shortenStepLabel,
} from "@/lib/garage/support";

describe("garage voice support detection", () => {
  it("reports no support outside browser", () => {
    const caps = detectVoiceCapabilities({
      hasWindow: false,
      speechRecognitionCtor: null,
      speechSynthesis: false,
    });
    expect(caps.speechRecognition).toBe(false);
    expect(caps.speechSynthesis).toBe(false);
    expect(getVoiceSupportNotice(caps)).toMatch(/browser/i);
  });

  it("reports full support when APIs present", () => {
    const caps = detectVoiceCapabilities({
      hasWindow: true,
      speechRecognitionCtor: "SpeechRecognition",
      speechSynthesis: true,
    });
    expect(caps.speechRecognition).toBe(true);
    expect(caps.speechSynthesis).toBe(true);
    expect(getVoiceSupportNotice(caps)).toBeNull();
  });

  it("degrades gracefully with synthesis only", () => {
    const caps = detectVoiceCapabilities({
      hasWindow: true,
      speechRecognitionCtor: null,
      speechSynthesis: true,
    });
    expect(getVoiceSupportNotice(caps)).toMatch(/Voice input is not supported/i);
  });

  it("degrades gracefully with recognition only", () => {
    const caps = detectVoiceCapabilities({
      hasWindow: true,
      speechRecognitionCtor: "SpeechRecognition",
      speechSynthesis: false,
    });
    expect(getVoiceSupportNotice(caps)).toMatch(/speech/i);
  });
});

describe("garage step text helpers", () => {
  it("shortens long labels for display", () => {
    const short = shortenStepLabel(
      "Turn OFF the Power Switch and unplug the Power Cord from its electrical outlet before proceeding",
      6,
    );
    expect(short.split(" ").length).toBeLessThanOrEqual(7);
  });

  it("builds speak text with optional detail", () => {
    expect(buildSpeakText("Power OFF", "Unplug welder")).toBe("Power OFF. Unplug welder");
  });

  it("formats mismatch chat prompt", () => {
    expect(resolveMismatchResponse("Twist cables clockwise")).toMatch(/doesn't match/i);
  });
});
