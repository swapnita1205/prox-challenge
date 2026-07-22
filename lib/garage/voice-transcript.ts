/** Pure helpers for Garage Mode voice transcript handling (no browser APIs). */

export const MIN_TRANSCRIPT_CHARS = 2;

export type VoiceInputPhase =
  | "idle"
  | "listening"
  | "heard"
  | "sending"
  | "error"
  | "unsupported";

export function normalizeTranscript(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** Reject empty, whitespace-only, or unusably short transcripts. */
export function isUsableTranscript(raw: string | null | undefined): boolean {
  const text = normalizeTranscript(raw);
  if (text.length < MIN_TRANSCRIPT_CHARS) return false;
  // Require at least one letter or digit so punctuation-only noise is ignored.
  return /[a-z0-9]/i.test(text);
}

/**
 * Format confirmed voice text for the same chat pipeline as typed messages.
 * Prefix keeps Garage Mode context without changing agent/retrieval behavior.
 */
export function formatGarageVoiceMessage(transcript: string): string {
  const text = normalizeTranscript(transcript);
  return `Garage Mode voice: ${text}`;
}

export function shouldAcceptTranscript(
  raw: string | null | undefined,
  options?: { lastSubmitted?: string | null; submitting?: boolean },
): { ok: true; text: string } | { ok: false; reason: "empty" | "duplicate" | "submitting" } {
  if (options?.submitting) return { ok: false, reason: "submitting" };
  if (!isUsableTranscript(raw)) return { ok: false, reason: "empty" };
  const text = normalizeTranscript(raw);
  if (
    options?.lastSubmitted &&
    normalizeTranscript(options.lastSubmitted) === text
  ) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true, text };
}

export const VOICE_UI = {
  listening: "Listening…",
  heard: (transcript: string) => `Heard: “${normalizeTranscript(transcript)}”`,
  send: "Send",
  retry: "Retry",
  cancel: "Cancel",
  sending: "Sending…",
  couldNotUnderstand: "Couldn't understand that. Try again.",
  unsupported: "Voice input is not supported in this browser.",
} as const;
