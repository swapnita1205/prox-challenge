"use client";

import { useState } from "react";
import Link from "next/link";
import { useConversation } from "@/lib/conversation/context";
import { MessageList } from "@/components/chat/MessageList";
import { ChatInput } from "@/components/chat/ChatInput";
import { ArtifactWorkspace } from "@/components/artifacts/ArtifactWorkspace";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { MachineDetectivePanel } from "@/components/diagnostics/MachineDetectivePanel";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { GarageModeEntry } from "@/components/garage/GarageModeEntry";
import { GarageModeView } from "@/components/garage/GarageModeView";
import { StatusStrip } from "@/components/workspace/StatusStrip";
import { MicroInteractionWatcher } from "@/components/workspace/MicroInteractionWatcher";
import { formatModeLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Flame } from "lucide-react";

interface WorkspaceLayoutProps {
  apiKeyConfigured: boolean;
}

export function WorkspaceLayout({ apiKeyConfigured }: WorkspaceLayoutProps) {
  const {
    conversation,
    isStreaming,
    error,
    clearError,
    lastFailedPrompt,
    retryLastMessage,
    progressSteps,
  } = useConversation();
  const [mobilePane, setMobilePane] = useState<"chat" | "artifacts">("chat");

  return (
    <div className="flex h-[100dvh] flex-col">
      <MicroInteractionWatcher />

      <header className="flex shrink-0 items-center justify-between border-b border-garage-border bg-garage-panel px-3 py-2 shadow-panel sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-garage-muted transition-colors hover:bg-garage-bg hover:text-garage-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garage-orange"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <div className="hidden h-4 w-px bg-garage-border sm:block" aria-hidden />
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 shrink-0 text-garage-orange" aria-hidden />
            <span className="truncate font-mono text-sm font-semibold tracking-tight">
              Weld<span className="text-garage-orange">Pilot</span>
            </span>
          </div>
          <Badge variant="outline" className="hidden font-mono text-2xs sm:inline-flex">
            {formatModeLabel(conversation.mode)}
          </Badge>
          <GarageModeEntry />
        </div>
        {!apiKeyConfigured && (
          <span
            className="flex max-w-[45%] items-center gap-1.5 truncate rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-2xs text-amber-200 sm:max-w-none sm:text-xs"
            role="status"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">API key missing — placeholder mode</span>
          </span>
        )}
      </header>

      <StatusStrip />

      {error && (
        <div
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200"
          role="alert"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <div className="flex shrink-0 gap-1">
            {lastFailedPrompt && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-red-500/40 text-red-100"
                disabled={isStreaming}
                onClick={() => {
                  clearError();
                  void retryLastMessage();
                }}
              >
                Retry
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clearError} className="shrink-0">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <SetupWizard />
      {conversation.mode === "diagnose" && <MachineDetectivePanel />}

      <main
        id="main-content"
        className="flex min-h-0 flex-1 flex-col lg:flex-row"
        tabIndex={-1}
      >
        <div
          className="flex shrink-0 border-b border-garage-border bg-garage-panel lg:hidden"
          role="tablist"
          aria-label="Workspace panes"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === "chat"}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
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
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              mobilePane === "artifacts"
                ? "border-b-2 border-garage-orange text-garage-text"
                : "text-garage-muted"
            }`}
            onClick={() => setMobilePane("artifacts")}
          >
            Artifacts
          </button>
        </div>

        {/* Chat pane */}
        <section
          className={`min-h-0 flex-1 flex-col border-b border-garage-border lg:flex lg:w-[48%] lg:min-w-0 lg:border-b-0 lg:border-r ${
            mobilePane === "chat" ? "flex" : "hidden"
          }`}
          aria-label="Conversation"
          role="tabpanel"
        >
          <MessageList
            messages={conversation.messages}
            isStreaming={isStreaming}
            progressSteps={progressSteps}
          />
          <ChatInput />
        </section>

        {/* Artifact pane */}
        <section
          className={`min-h-0 flex-1 flex-col lg:flex lg:w-[52%] lg:min-w-0 ${
            mobilePane === "artifacts" ? "flex" : "hidden"
          }`}
          aria-label="Artifacts and evidence"
          role="tabpanel"
        >
          <ArtifactWorkspace />
          <EvidenceDrawer />
        </section>
      </main>

      <GarageModeView />
    </div>
  );
}
