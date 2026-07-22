import { describe, expect, it, vi } from "vitest";
import {
  detectVoiceCapabilities,
  getVoiceSupportNotice,
  prepareRecognitionStart,
} from "@/lib/garage/support";
import {
  VOICE_UI,
  formatGarageVoiceMessage,
  isUsableTranscript,
  normalizeTranscript,
  shouldAcceptTranscript,
} from "@/lib/garage/voice-transcript";
import { extractProcedureFromArtifacts } from "@/lib/garage/procedures";
import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";

describe("voice transcript helpers", () => {
  it("normalizes whitespace", () => {
    expect(normalizeTranscript("  polarity   is wrong  ")).toBe("polarity is wrong");
  });

  it("ignores empty and unusably short transcripts", () => {
    expect(isUsableTranscript("")).toBe(false);
    expect(isUsableTranscript("   ")).toBe(false);
    expect(isUsableTranscript(".")).toBe(false);
    expect(isUsableTranscript("a")).toBe(false);
    expect(isUsableTranscript("ok")).toBe(true);
    expect(isUsableTranscript("  DCEN  ")).toBe(true);
  });

  it("formats confirmed transcript for the chat pipeline", () => {
    expect(formatGarageVoiceMessage("ground clamp on positive")).toBe(
      "Garage Mode voice: ground clamp on positive",
    );
  });

  it("suppresses duplicates and in-flight submissions", () => {
    expect(
      shouldAcceptTranscript("check polarity", {
        lastSubmitted: "check polarity",
      }).ok,
    ).toBe(false);
    expect(
      shouldAcceptTranscript("check polarity", { submitting: true }).ok,
    ).toBe(false);
    expect(shouldAcceptTranscript("check polarity").ok).toBe(true);
  });

  it("exposes required UI copy", () => {
    expect(VOICE_UI.listening).toBe("Listening…");
    expect(VOICE_UI.heard("hello")).toContain("Heard:");
    expect(VOICE_UI.heard("hello")).toContain("hello");
    expect(VOICE_UI.send).toBe("Send");
    expect(VOICE_UI.retry).toBe("Retry");
    expect(VOICE_UI.cancel).toBe("Cancel");
    expect(VOICE_UI.sending).toBe("Sending…");
    expect(VOICE_UI.couldNotUnderstand).toMatch(/Couldn't understand/i);
    expect(VOICE_UI.unsupported).toBe(
      "Voice input is not supported in this browser.",
    );
  });
});

describe("voice capability fallback", () => {
  it("reports unsupported browser for missing SpeechRecognition", () => {
    const caps = detectVoiceCapabilities({
      hasWindow: true,
      speechRecognitionCtor: null,
      speechSynthesis: true,
    });
    expect(caps.speechRecognition).toBe(false);
    expect(getVoiceSupportNotice(caps)).toMatch(
      /Voice input is not supported in this browser/i,
    );
  });
});

describe("TTS interruption before listen", () => {
  it("cancels speech before clearing transcript", () => {
    const order: string[] = [];
    prepareRecognitionStart({
      cancelSpeech: () => order.push("cancelSpeech"),
      clearPendingTranscript: () => order.push("clear"),
    });
    expect(order).toEqual(["cancelSpeech", "clear"]);
  });
});

describe("confirmed transcript → chat pipeline", () => {
  it("submits through sendMessage with garage voice prefix", async () => {
    const sendMessage = vi.fn(async (_content: string) => undefined);
    const decision = shouldAcceptTranscript("wire keeps birdnesting");
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;

    await sendMessage(formatGarageVoiceMessage(decision.text));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(
      "Garage Mode voice: wire keeps birdnesting",
    );
  });

  it("retry path clears prior transcript acceptance", () => {
    const first = shouldAcceptTranscript("first attempt");
    expect(first.ok).toBe(true);
    // After cancel/retry, a new utterance is allowed even if similar.
    const second = shouldAcceptTranscript("first attempt", {
      lastSubmitted: null,
      submitting: false,
    });
    expect(second.ok).toBe(true);
  });
});

describe("Garage Mode procedure updates after agent artifacts", () => {
  it("rebuilds procedure when a new checklist artifact arrives", () => {
    const before = extractProcedureFromArtifacts({
      a: {
        spec: {
          type: "step-by-step-checklist",
          title: "Initial",
          steps: [{ id: "s1", label: "Power OFF", completed: false }],
          citations: [],
        } as ArtifactSpec,
      },
    });
    expect(before?.steps).toHaveLength(1);

    const after = extractProcedureFromArtifacts({
      a: {
        spec: {
          type: "step-by-step-checklist",
          title: "Updated after voice reply",
          steps: [
            { id: "s1", label: "Power OFF", completed: false },
            { id: "s2", label: "Set DCEN polarity", detail: "p.13", completed: false },
          ],
          citations: [{ source: "owner-manual.pdf", page: 13 }],
        } as ArtifactSpec,
      },
    });
    expect(after?.title).toMatch(/Updated/);
    expect(after?.steps).toHaveLength(2);
    expect(after?.steps[1]?.speakText).toMatch(/DCEN|polarity/i);
  });
});

describe("recognition error UX copy", () => {
  it("maps failed recognition to retry prompt", () => {
    expect(VOICE_UI.couldNotUnderstand).toBe(
      "Couldn't understand that. Try again.",
    );
  });
});
