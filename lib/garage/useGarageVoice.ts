"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceCapabilities } from "@/lib/garage/schemas";
import {
  detectVoiceCapabilities,
  prepareRecognitionStart,
} from "@/lib/garage/support";
import {
  isUsableTranscript,
  normalizeTranscript,
} from "@/lib/garage/voice-transcript";

function getBrowserEnv() {
  if (typeof window === "undefined") {
    return { hasWindow: false, speechRecognitionCtor: null, speechSynthesis: false };
  }
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return {
    hasWindow: true,
    speechRecognitionCtor: ctor ? "SpeechRecognition" : null,
    speechSynthesis: typeof window.speechSynthesis !== "undefined",
  };
}

export function useGarageVoice(voiceEnabled: boolean) {
  const [capabilities, setCapabilities] = useState<VoiceCapabilities>(() =>
    detectVoiceCapabilities({
      hasWindow: false,
      speechRecognitionCtor: null,
      speechSynthesis: false,
    }),
  );
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  /** True once this recognition session produced a usable result. */
  const gotResultRef = useRef(false);
  const sessionRef = useRef(0);

  useEffect(() => {
    setCapabilities(detectVoiceCapabilities(getBrowserEnv()));
  }, []);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    utteranceRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || !capabilities.speechSynthesis) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      cancelSpeech();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled, capabilities.speechSynthesis, cancelSpeech],
  );

  const clearTranscript = useCallback(() => {
    setLastTranscript(null);
    setRecognitionError(null);
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // already stopped
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!voiceEnabled || !capabilities.speechRecognition) return;
    if (typeof window === "undefined") return;

    // Requirement: cancel active TTS before recognition.
    prepareRecognitionStart({
      cancelSpeech,
      clearPendingTranscript: () => {
        setRecognitionError(null);
        setLastTranscript(null);
      },
    });
    gotResultRef.current = false;
    const session = ++sessionRef.current;

    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognition;
      webkitSpeechRecognition?: new () => SpeechRecognition;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      if (session !== sessionRef.current) return;
      setIsListening(true);
    };

    recognition.onend = () => {
      if (session !== sessionRef.current) return;
      setIsListening(false);
      if (!gotResultRef.current) {
        setRecognitionError("no-speech");
      }
    };

    recognition.onerror = (event: Event) => {
      if (session !== sessionRef.current) return;
      setIsListening(false);
      const err = (event as SpeechRecognitionErrorEvent | undefined)?.error;
      // "aborted" from intentional stop/retry — not a user-facing failure.
      if (err === "aborted") return;
      setRecognitionError(err ?? "error");
      if (!gotResultRef.current) {
        setLastTranscript(null);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (session !== sessionRef.current) return;
      const raw = event.results[0]?.[0]?.transcript ?? "";
      if (!isUsableTranscript(raw)) {
        setRecognitionError("no-speech");
        setLastTranscript(null);
        return;
      }
      gotResultRef.current = true;
      setRecognitionError(null);
      setLastTranscript(normalizeTranscript(raw));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setRecognitionError("error");
    }
  }, [voiceEnabled, capabilities.speechRecognition, cancelSpeech]);

  const retryListening = useCallback(() => {
    clearTranscript();
    startListening();
  }, [clearTranscript, startListening]);

  useEffect(() => {
    return () => {
      cancelSpeech();
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, [cancelSpeech]);

  return {
    capabilities,
    isListening,
    isSpeaking,
    lastTranscript,
    recognitionError,
    speak,
    cancelSpeech,
    startListening,
    stopListening,
    retryListening,
    clearTranscript,
  };
}

/** Narrow typing for SpeechRecognition error events (not in all DOM libs). */
interface SpeechRecognitionErrorEvent extends Event {
  error?: string;
}
