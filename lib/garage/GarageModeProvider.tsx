"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GarageProcedure } from "@/lib/garage/schemas";
import { extractProcedureFromArtifacts } from "@/lib/garage/procedures";
import {
  formatGarageVoiceMessage,
  shouldAcceptTranscript,
} from "@/lib/garage/voice-transcript";
import { useConversation } from "@/lib/conversation/context";

interface GarageModeContextValue {
  active: boolean;
  procedure: GarageProcedure | null;
  stepIndex: number;
  completedStepIds: string[];
  voiceEnabled: boolean;
  isSubmittingVoice: boolean;
  enterGarageMode: () => void;
  exitGarageMode: () => void;
  setVoiceEnabled: (enabled: boolean) => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  confirmStep: () => void;
  reportMismatch: () => Promise<void>;
  /** Confirmed voice transcript → same sendMessage pipeline as typed chat. */
  submitVoiceTranscript: (transcript: string) => Promise<boolean>;
}

const GarageModeContext = createContext<GarageModeContextValue | null>(null);

const STORAGE_KEY = "weldpilot-garage-voice";

export function useGarageMode() {
  const ctx = useContext(GarageModeContext);
  if (!ctx) throw new Error("useGarageMode must be used within GarageModeProvider");
  return ctx;
}

export function GarageModeProvider({ children }: { children: ReactNode }) {
  const { artifacts, sendMessage, isStreaming } = useConversation();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  // Default to the server-safe value so the initial client render matches the
  // SSR output (no hydration mismatch), then reconcile with the persisted
  // preference after mount.
  const [voiceEnabled, setVoiceEnabledState] = useState(true);
  const [voiceSubmitting, setVoiceSubmitting] = useState(false);
  const lastSubmittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVoiceEnabledState(window.localStorage.getItem(STORAGE_KEY) !== "off");
  }, []);

  const procedure = useMemo(
    () => (active ? extractProcedureFromArtifacts(artifacts) : null),
    [active, artifacts],
  );

  const setVoiceEnabled = useCallback((enabled: boolean) => {
    setVoiceEnabledState(enabled);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    }
  }, []);

  const enterGarageMode = useCallback(() => {
    setActive(true);
    setStepIndex(0);
    setCompletedStepIds([]);
    lastSubmittedRef.current = null;
  }, []);

  const exitGarageMode = useCallback(() => {
    setActive(false);
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (!procedure) return;
      setStepIndex(Math.max(0, Math.min(index, procedure.steps.length - 1)));
    },
    [procedure],
  );

  const nextStep = useCallback(() => {
    if (!procedure) return;
    setStepIndex((i) => Math.min(i + 1, procedure.steps.length - 1));
  }, [procedure]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const confirmStep = useCallback(() => {
    if (!procedure) return;
    const step = procedure.steps[stepIndex];
    if (!step) return;
    setCompletedStepIds((prev) => [...new Set([...prev, step.id])]);
    if (stepIndex < procedure.steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [procedure, stepIndex]);

  const reportMismatch = useCallback(async () => {
    if (!procedure) return;
    const step = procedure.steps[stepIndex];
    if (!step) return;
    const prompt = `Garage Mode — step ${stepIndex + 1} doesn't match what I see: "${step.shortLabel}". What I observe: `;
    await sendMessage(prompt);
  }, [procedure, stepIndex, sendMessage]);

  const submitVoiceTranscript = useCallback(
    async (transcript: string): Promise<boolean> => {
      const decision = shouldAcceptTranscript(transcript, {
        lastSubmitted: lastSubmittedRef.current,
        submitting: voiceSubmitting || isStreaming,
      });
      if (!decision.ok) return false;

      setVoiceSubmitting(true);
      // Suppress duplicate Send clicks / re-entrancy for this utterance.
      lastSubmittedRef.current = decision.text;
      try {
        await sendMessage(formatGarageVoiceMessage(decision.text));
        return true;
      } catch {
        return false;
      } finally {
        // Allow the same phrase later; in-flight guard is voiceSubmitting/isStreaming.
        lastSubmittedRef.current = null;
        setVoiceSubmitting(false);
      }
    },
    [sendMessage, voiceSubmitting, isStreaming],
  );

  const value: GarageModeContextValue = {
    active,
    procedure,
    stepIndex,
    completedStepIds,
    voiceEnabled,
    isSubmittingVoice: voiceSubmitting || isStreaming,
    enterGarageMode,
    exitGarageMode,
    setVoiceEnabled,
    goToStep,
    nextStep,
    prevStep,
    confirmStep,
    reportMismatch,
    submitVoiceTranscript,
  };

  return (
    <GarageModeContext.Provider value={value}>
      {children}
    </GarageModeContext.Provider>
  );
}
