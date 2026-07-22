"use client";

import { useEffect, useCallback, useState, type ReactNode } from "react";
import { useGarageMode } from "@/lib/garage/GarageModeProvider";
import { useGarageVoice } from "@/lib/garage/useGarageVoice";
import { getVoiceSupportNotice } from "@/lib/garage/support";
import { VOICE_UI } from "@/lib/garage/voice-transcript";
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  Volume2,
  X,
  Check,
  HelpCircle,
  Send,
  RotateCcw,
} from "lucide-react";

export function GarageModeView() {
  const {
    active,
    procedure,
    stepIndex,
    completedStepIds,
    voiceEnabled,
    isSubmittingVoice,
    exitGarageMode,
    setVoiceEnabled,
    nextStep,
    prevStep,
    confirmStep,
    reportMismatch,
    submitVoiceTranscript,
  } = useGarageMode();

  const {
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
  } = useGarageVoice(voiceEnabled);

  const [sendError, setSendError] = useState<string | null>(null);

  const step = procedure?.steps[stepIndex];
  const total = procedure?.steps.length ?? 0;
  const supportNotice = getVoiceSupportNotice(capabilities);
  const hasHeard = Boolean(lastTranscript);
  const showVoiceError = Boolean(recognitionError) && !hasHeard && !isListening;

  const repeatInstruction = useCallback(() => {
    if (step) speak(step.speakText);
  }, [step, speak]);

  // Existing procedure TTS only — do not add a second competing speak path.
  useEffect(() => {
    if (!active || !step || !voiceEnabled) return;
    speak(step.speakText);
    return () => cancelSpeech();
  }, [active, stepIndex, step?.id, voiceEnabled]); // eslint-disable-line react-hooks/exhaustive-deps -- speak one step at a time on step change

  const handleCancelTranscript = useCallback(() => {
    stopListening();
    clearTranscript();
    setSendError(null);
  }, [stopListening, clearTranscript]);

  const handleSendTranscript = useCallback(async () => {
    if (!lastTranscript || isSubmittingVoice) return;
    setSendError(null);
    const ok = await submitVoiceTranscript(lastTranscript);
    if (ok) {
      clearTranscript();
    } else {
      setSendError("Could not send. Try again.");
    }
  }, [lastTranscript, isSubmittingVoice, submitVoiceTranscript, clearTranscript]);

  const handleRetry = useCallback(() => {
    setSendError(null);
    retryListening();
  }, [retryListening]);

  if (!active) return null;

  if (!procedure || !step) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-garage-bg text-garage-text">
        <header className="flex items-center justify-between border-b border-garage-border bg-garage-panel px-4 py-4">
          <h1 className="font-mono text-lg font-bold uppercase tracking-widest">
            Garage Mode
          </h1>
          <button
            type="button"
            onClick={exitGarageMode}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-md border border-garage-border px-4 text-sm font-semibold transition-colors hover:border-garage-orange/50"
          >
            <X className="mr-1 h-5 w-5" aria-hidden />
            Exit
          </button>
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-2xl font-semibold tracking-tight">No procedure loaded</p>
          <p className="max-w-md text-base leading-relaxed text-garage-muted">
            Generate a Setup Pack or open a checklist in full view first, then enter Garage Mode.
          </p>
          <button
            type="button"
            onClick={exitGarageMode}
            className="min-h-[56px] rounded-md bg-garage-orange px-8 text-lg font-bold text-white transition-colors hover:bg-garage-orange-dim active:scale-[0.98]"
          >
            Back to full view
          </button>
        </main>
      </div>
    );
  }

  const isDone = completedStepIds.includes(step.id);
  const atStart = stepIndex === 0;
  const atEnd = stepIndex >= total - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-garage-bg text-garage-text"
      role="dialog"
      aria-label="Garage Mode"
      aria-modal="true"
    >
      <header className="flex items-center justify-between gap-2 border-b border-garage-border bg-garage-panel px-4 py-3">
        <div className="min-w-0">
          <p className="label-caps text-garage-orange">Garage Mode</p>
          <p className="truncate text-sm text-garage-muted">{procedure.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex min-h-[48px] min-w-[48px] items-center justify-center rounded-md border px-3 transition-colors ${
              voiceEnabled
                ? "border-garage-orange/50 text-garage-orange"
                : "border-garage-border text-garage-muted"
            }`}
            aria-label={voiceEnabled ? "Disable voice" : "Enable voice"}
          >
            {voiceEnabled ? (
              <Volume2 className="h-6 w-6" aria-hidden />
            ) : (
              <MicOff className="h-6 w-6" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              cancelSpeech();
              stopListening();
              clearTranscript();
              exitGarageMode();
            }}
            className="flex min-h-[48px] items-center justify-center rounded-md border border-garage-border px-4 text-sm font-semibold transition-colors hover:border-garage-orange/40"
          >
            <X className="mr-1 h-5 w-5" aria-hidden />
            Full view
          </button>
        </div>
      </header>

      {supportNotice && (
        <div
          className="border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 text-sm text-amber-100"
          role="status"
        >
          {!capabilities.speechRecognition
            ? VOICE_UI.unsupported
            : supportNotice}
        </div>
      )}

      <main className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6">
        <p className="font-mono text-base text-garage-orange sm:text-lg">
          Step {stepIndex + 1} of {total}
          {isDone && " ✓"}
        </p>

        <div
          className={`max-w-lg rounded-lg border-2 px-6 py-8 text-center sm:px-8 sm:py-10 ${
            step.safetyCritical
              ? "border-amber-500/50 bg-amber-500/8"
              : "border-garage-border bg-garage-panel"
          }`}
        >
          <p className="text-2xl font-bold leading-tight sm:text-3xl">{step.shortLabel}</p>
          {step.safetyCritical && (
            <p className="mt-3 text-base font-semibold text-amber-300">Safety step</p>
          )}
        </div>

        {isSpeaking && !isListening && !hasHeard && (
          <p className="text-sm text-garage-orange animate-pulse" aria-live="polite">
            Speaking…
          </p>
        )}

        {isListening && (
          <p className="text-sm text-sky-300 animate-pulse" aria-live="polite">
            {VOICE_UI.listening}
          </p>
        )}

        {showVoiceError && (
          <div
            className="max-w-lg rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center"
            role="alert"
          >
            <p className="text-sm font-medium text-amber-100">
              {VOICE_UI.couldNotUnderstand}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={!voiceEnabled || !capabilities.speechRecognition}
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-amber-500/40 px-4 text-sm font-bold text-amber-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {VOICE_UI.retry}
            </button>
          </div>
        )}

        {hasHeard && (
          <div
            className="w-full max-w-lg rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-4"
            role="region"
            aria-label="Recognized speech"
          >
            <p className="text-center text-base font-medium text-sky-50" aria-live="polite">
              {VOICE_UI.heard(lastTranscript!)}
            </p>
            {sendError && (
              <p className="mt-2 text-center text-sm text-red-300" role="alert">
                {sendError}
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => void handleSendTranscript()}
                disabled={isSubmittingVoice}
                className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md bg-garage-orange text-sm font-bold text-white disabled:opacity-40"
              >
                <Send className="h-5 w-5" aria-hidden />
                {isSubmittingVoice ? VOICE_UI.sending : VOICE_UI.send}
              </button>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isSubmittingVoice || !capabilities.speechRecognition}
                className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md border border-garage-border text-sm font-bold disabled:opacity-40"
              >
                <RotateCcw className="h-5 w-5" aria-hidden />
                {VOICE_UI.retry}
              </button>
              <button
                type="button"
                onClick={handleCancelTranscript}
                disabled={isSubmittingVoice}
                className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md border border-garage-border text-sm font-bold disabled:opacity-40"
              >
                <X className="h-5 w-5" aria-hidden />
                {VOICE_UI.cancel}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="grid gap-3 border-t border-garage-border bg-garage-panel p-4 pb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GarageButton
            label="Repeat"
            icon={<Volume2 className="h-7 w-7" />}
            onClick={repeatInstruction}
            disabled={!voiceEnabled || !capabilities.speechSynthesis}
          />
          <GarageButton
            label="Previous"
            icon={<ChevronLeft className="h-7 w-7" />}
            onClick={prevStep}
            disabled={atStart}
          />
          <GarageButton
            label="Next"
            icon={<ChevronRight className="h-7 w-7" />}
            onClick={nextStep}
            disabled={atEnd}
          />
          <GarageButton
            label={isListening ? "Stop" : "Talk"}
            icon={<Mic className={`h-7 w-7 ${isListening ? "text-red-400" : ""}`} />}
            onClick={() => (isListening ? stopListening() : startListening())}
            disabled={
              !voiceEnabled ||
              !capabilities.speechRecognition ||
              isSubmittingVoice ||
              hasHeard
            }
            variant={isListening ? "danger" : "default"}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={confirmStep}
            className="flex min-h-[64px] items-center justify-center gap-2 rounded-md bg-emerald-500 text-xl font-bold text-black transition-transform active:scale-[0.98] hover:bg-emerald-400"
          >
            <Check className="h-8 w-8" aria-hidden />
            I did it
          </button>
          <button
            type="button"
            onClick={() => void reportMismatch()}
            className="flex min-h-[64px] items-center justify-center gap-2 rounded-md border-2 border-amber-500/50 bg-amber-500/10 text-lg font-bold text-amber-100 transition-transform active:scale-[0.98] hover:bg-amber-500/15"
          >
            <HelpCircle className="h-7 w-7" aria-hidden />
            Doesn&apos;t match what I see
          </button>
        </div>

        <p className="text-center font-mono text-2xs text-garage-muted">
          Push-to-talk · confirm before send · citations stay in full view
        </p>
      </footer>
    </div>
  );
}

function GarageButton({
  label,
  icon,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-md border text-sm font-bold transition active:scale-[0.98] disabled:opacity-30 ${
        variant === "danger"
          ? "border-red-500/50 bg-red-500/15 text-red-200"
          : "border-garage-border bg-garage-bg text-garage-text hover:border-garage-border-bright"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
