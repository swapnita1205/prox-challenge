"use client";

import { useConversation } from "@/lib/conversation/context";
import { ArtifactRenderer } from "@/components/artifacts/ArtifactRenderer";
import { ArtifactPlaceholder } from "@/components/artifacts/ArtifactPlaceholder";
import { getArtifactTitle } from "@/lib/artifacts/registry";
import { artifactLoadingHeading } from "@/lib/agent/progress";
import { useMicroFlash } from "@/lib/ui/micro-interactions";
import { cn } from "@/lib/utils";
import { Layers, Loader2 } from "lucide-react";

export function ArtifactWorkspace() {
  const { activeArtifact, conversation, isStreaming, progressSteps } = useConversation();
  const artifactFlash = useMicroFlash("artifact");

  const artifactHint = [...progressSteps].reverse().find((s) => s.icon === "artifact");
  const loadingHeading = artifactLoadingHeading(artifactHint?.artifactType);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      aria-label="Artifact workspace"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-garage-border bg-garage-panel/50 px-3 py-2.5 sm:px-4">
        <Layers className="h-4 w-4 shrink-0 text-garage-orange" aria-hidden />
        <h2 className="truncate font-mono text-xs font-semibold uppercase tracking-widest text-garage-text sm:text-sm">
          {activeArtifact
            ? getArtifactTitle(activeArtifact.spec)
            : isStreaming
              ? loadingHeading
              : "Visual workspace"}
        </h2>
        {isStreaming && !activeArtifact && (
          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-garage-orange" aria-hidden />
        )}
      </header>

      <div
        className={cn(
          "flex-1 overflow-y-auto p-3 sm:p-4",
          artifactFlash && "micro-flash-active",
        )}
      >
        {activeArtifact ? (
          <ArtifactRenderer spec={activeArtifact.spec} />
        ) : isStreaming ? (
          <div
            className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-garage-border bg-garage-panel/40 p-6"
            role="status"
            aria-live="polite"
          >
            <div className="h-24 w-full max-w-sm animate-pulse rounded-md bg-garage-border/40" />
            <div className="h-3 w-2/3 max-w-xs animate-pulse rounded bg-garage-border/30" />
            <p className="text-sm text-garage-muted">{loadingHeading}</p>
          </div>
        ) : (
          <ArtifactPlaceholder
            spec={{
              type: "placeholder",
              title: "No artifact yet",
              description: `Start a ${conversation.mode} session and send a message. Interactive diagrams, calculators, and manual images will appear here.`,
            }}
          />
        )}
      </div>
    </section>
  );
}
