"use client";

import { useState } from "react";
import Link from "next/link";
import { useConversation } from "@/lib/conversation/context";
import { useMachineDetective } from "@/lib/detective/useMachineDetective";
import type { DemoScenario } from "@/lib/demo/scenarios";
import { DEMO_SCENARIOS } from "@/lib/demo/scenarios";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { ArtifactWorkspace } from "@/components/artifacts/ArtifactWorkspace";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { MachineDetectivePanel } from "@/components/diagnostics/MachineDetectivePanel";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { DemoOrchestrator } from "@/components/demo/DemoOrchestrator";
import { ConfidenceCollapseChart } from "@/components/demo/ConfidenceCollapseChart";
import { GarageModeEntry } from "@/components/garage/GarageModeEntry";
import { GarageModeView } from "@/components/garage/GarageModeView";
import { DemoSettingsPanel } from "@/components/demo/DemoSettingsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  RotateCcw,
  RefreshCw,
} from "lucide-react";

interface DemoRunnerLayoutProps {
  scenario: DemoScenario;
  apiKeyConfigured: boolean;
  mockVision: boolean;
  onMockVisionChange: (enabled: boolean) => void;
  showMockToggle: boolean;
  onResetDemo: () => void;
}

export function DemoRunnerLayout({
  scenario,
  apiKeyConfigured,
  mockVision,
  onMockVisionChange,
  showMockToggle,
  onResetDemo,
}: DemoRunnerLayoutProps) {
  const {
    conversation,
    isStreaming,
    error,
    clearError,
    lastFailedPrompt,
    retryLastMessage,
    progressSteps,
  } = useConversation();
  const { session } = useMachineDetective(conversation.id);
  const [orchestratorError, setOrchestratorError] = useState<string | null>(null);
  const [initialUncertainty] = useState(() => session?.uncertainty ?? 0.85);
  const [watchOpen, setWatchOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"chat" | "artifacts">("chat");

  const displayError = orchestratorError ?? error;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-garage-border bg-garage-panel px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/demo"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-garage-text hover:bg-garage-bg"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Demo hub</span>
            </Link>
            <Badge variant="outline" className="font-mono">
              {DEMO_SCENARIO_INDEX[scenario.id]}/5
            </Badge>
            <h1 className="truncate text-sm font-semibold text-garage-text">{scenario.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {!apiKeyConfigured && (
              <span className="flex items-center gap-1 text-2xs text-amber-400 sm:text-xs">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden md:inline">Placeholder mode</span>
              </span>
            )}
            {showMockToggle && scenario.action === "visual-analysis" && (
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-2 py-1 text-2xs text-amber-200">
                <FlaskConical className="h-3 w-3" />
                <input
                  type="checkbox"
                  checked={mockVision}
                  onChange={(e) => onMockVisionChange(e.target.checked)}
                  className="rounded"
                />
                Mock
              </label>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={onResetDemo}
              aria-label="Reset demo session"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reset Demo
            </Button>
            <GarageModeEntry />
            {getNextScenarioId(scenario.id) && (
              <Link
                href={`/demo/${getNextScenarioId(scenario.id)}`}
                className="inline-flex h-8 items-center rounded-md border border-garage-border bg-garage-panel px-2 text-xs font-medium text-garage-text hover:bg-garage-bg sm:px-3"
              >
                Next →
              </Link>
            )}
          </div>
        </div>

        <div className="mt-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-garage-border bg-garage-bg px-3 py-1.5 text-left text-2xs font-mono uppercase tracking-wide text-garage-muted hover:bg-garage-panel sm:hidden"
            aria-expanded={watchOpen}
            onClick={() => setWatchOpen((o) => !o)}
          >
            What to watch for
            <span aria-hidden>{watchOpen ? "−" : "+"}</span>
          </button>
          <aside
            className={`mt-0 rounded-lg border border-garage-border bg-garage-bg p-2.5 sm:mt-2 sm:p-3 ${
              watchOpen ? "block" : "hidden sm:block"
            }`}
          >
            <p className="mb-1.5 hidden font-mono text-xs uppercase tracking-wide text-garage-muted sm:block">
              What to watch for
            </p>
            <ul className="grid gap-1 sm:grid-cols-2" role="list">
              {scenario.expectedHighlights.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-garage-text">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-garage-orange" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </header>

      {displayError && (
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200"
          role="alert"
        >
          <span className="min-w-0 flex-1">{displayError}</span>
          <div className="flex shrink-0 gap-1">
            {lastFailedPrompt ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-red-500/40 text-red-100"
                onClick={() => {
                  setOrchestratorError(null);
                  clearError();
                  void retryLastMessage();
                }}
                disabled={isStreaming}
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Retry
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-red-500/40 text-red-100"
                onClick={() => {
                  setOrchestratorError(null);
                  clearError();
                  onResetDemo();
                }}
                disabled={isStreaming}
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Retry
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOrchestratorError(null);
                clearError();
              }}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <DemoOrchestrator
        key={`orch-${conversation.id}`}
        scenario={scenario}
        mockVision={mockVision}
        onError={setOrchestratorError}
      />

      <div className="min-h-0 shrink overflow-y-auto">
        {conversation.mode === "setup" && scenario.id !== "tig-setup" && <SetupWizard />}
        {conversation.mode === "settings" && scenario.setupInputs && (
          <DemoSettingsPanel inputs={scenario.setupInputs} scenarioPrompt={scenario.prompt} />
        )}
        {conversation.mode === "diagnose" && (
          <>
            <MachineDetectivePanel />
            {scenario.id === "flux-porosity" && (
              <div className="border-b border-garage-border px-4 py-2">
                <ConfidenceCollapseChart session={session} initialUncertainty={initialUncertainty} />
              </div>
            )}
          </>
        )}
      </div>

      <div
        className="flex shrink-0 border-b border-garage-border bg-garage-panel lg:hidden"
        role="tablist"
        aria-label="Demo panes"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === "chat"}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            mobilePane === "chat"
              ? "border-b-2 border-garage-orange text-garage-text"
              : "text-garage-muted"
          }`}
          onClick={() => setMobilePane("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePane === "artifacts"}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            mobilePane === "artifacts"
              ? "border-b-2 border-garage-orange text-garage-text"
              : "text-garage-muted"
          }`}
          onClick={() => setMobilePane("artifacts")}
        >
          Artifacts
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className={`min-h-0 flex-1 flex-col border-b border-garage-border lg:flex lg:w-1/2 lg:border-b-0 lg:border-r ${
            mobilePane === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          <div className="shrink-0 border-b border-garage-border bg-garage-bg/50 px-3 py-1.5 sm:px-4 sm:py-2">
            <p className="truncate text-xs text-garage-muted">
              <span className="font-medium text-garage-text">Prompt: </span>
              &ldquo;{scenario.prompt}&rdquo;
            </p>
          </div>
          <MessageList
            messages={conversation.messages}
            isStreaming={isStreaming}
            progressSteps={progressSteps}
          />
          <ChatInput />
        </div>
        <div
          className={`min-h-0 flex-1 flex-col lg:flex lg:w-1/2 ${
            mobilePane === "artifacts" ? "flex" : "hidden lg:flex"
          }`}
        >
          <ArtifactWorkspace />
          <EvidenceDrawer />
        </div>
      </div>
      <GarageModeView />
    </div>
  );
}

const DEMO_SCENARIO_INDEX: Record<DemoScenario["id"], number> = {
  "duty-cycle": 1,
  "tig-setup": 2,
  "flux-porosity": 3,
  "settings-configurator": 4,
  "visual-diagnosis": 5,
};

function getNextScenarioId(currentId: DemoScenario["id"]): DemoScenario["id"] | null {
  const idx = DEMO_SCENARIOS.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx >= DEMO_SCENARIOS.length - 1) return null;
  return DEMO_SCENARIOS[idx + 1]!.id;
}
