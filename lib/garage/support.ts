import type { VoiceCapabilities } from "@/lib/garage/schemas";

export interface BrowserVoiceEnvironment {
  hasWindow: boolean;
  speechRecognitionCtor: string | null;
  speechSynthesis: boolean;
}

export function detectVoiceCapabilities(env: BrowserVoiceEnvironment): VoiceCapabilities {
  if (!env.hasWindow) {
    return {
      speechRecognition: false,
      speechSynthesis: false,
      speechRecognitionReason: "Not in a browser environment.",
      speechSynthesisReason: "Not in a browser environment.",
    };
  }

  const speechRecognition = env.speechRecognitionCtor !== null;
  const speechSynthesis = env.speechSynthesis;

  return {
    speechRecognition,
    speechSynthesis,
    speechRecognitionReason: speechRecognition
      ? undefined
      : "Voice input is not supported in this browser.",
    speechSynthesisReason: speechSynthesis
      ? undefined
      : "Text-to-speech is not supported in this browser. Read steps on screen.",
  };
}

export function getVoiceSupportNotice(capabilities: VoiceCapabilities): string | null {
  if (capabilities.speechRecognition && capabilities.speechSynthesis) {
    return null;
  }
  const parts: string[] = [];
  if (!capabilities.speechRecognition) {
    parts.push(
      capabilities.speechRecognitionReason ??
        "Voice input is not supported in this browser.",
    );
  }
  if (!capabilities.speechSynthesis) {
    parts.push(capabilities.speechSynthesisReason ?? "Voice output unavailable.");
  }
  return parts.join(" ");
}

export function shortenStepLabel(label: string, maxWords = 8): string {
  const words = label.trim().split(/\s+/);
  if (words.length <= maxWords) return label.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function buildSpeakText(label: string, detail?: string): string {
  const base = label.replace(/\s+/g, " ").trim();
  if (!detail) return base;
  const shortDetail = detail.length > 80 ? `${detail.slice(0, 77)}…` : detail;
  return `${base}. ${shortDetail}`;
}

export function resolveMismatchResponse(stepLabel: string): string {
  return `Garage Mode: Step "${stepLabel}" doesn't match what I see on the machine. What do you observe?`;
}

/** Ensures TTS is cancelled before a new recognition session (testable order). */
export function prepareRecognitionStart(actions: {
  cancelSpeech: () => void;
  clearPendingTranscript: () => void;
}): void {
  actions.cancelSpeech();
  actions.clearPendingTranscript();
}
