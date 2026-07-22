"use client";

import { useConversation } from "@/lib/conversation/context";
import { GroundingBanner } from "@/components/grounding/GroundingBanner";
import { HowReachedPanelView } from "@/components/grounding/HowReachedPanel";
import { SourcePageViewer } from "@/components/evidence/SourcePageViewer";
import { useMicroFlash } from "@/lib/ui/micro-interactions";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";

export function EvidenceDrawer() {
  const { citations, grounding, evidenceOpen, setEvidenceOpen } = useConversation();
  const evidenceFlash = useMicroFlash("evidence");

  return (
    <div
      className={cn(
        "shrink-0 border-t border-garage-border bg-garage-bg",
        evidenceFlash && "micro-flash-active",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between rounded-none px-3 py-2.5 sm:px-4"
        onClick={() => setEvidenceOpen(!evidenceOpen)}
        aria-expanded={evidenceOpen}
        aria-controls="evidence-panel"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-garage-text">
          <FileText className="h-4 w-4 text-garage-orange" aria-hidden />
          Grounding & evidence
          {citations.length > 0 && (
            <Badge variant="default" className="font-mono text-2xs">
              {citations.length} citation{citations.length === 1 ? "" : "s"}
            </Badge>
          )}
          {grounding && (
            <Badge variant="outline" className="hidden font-mono text-2xs sm:inline-flex">
              {grounding.status.replace(/_/g, " ")}
            </Badge>
          )}
        </span>
        {evidenceOpen ? (
          <ChevronUp className="h-4 w-4 text-garage-muted" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-garage-muted" aria-hidden />
        )}
      </Button>

      <div
        id="evidence-panel"
        className={cn(
          "drawer-panel overflow-hidden",
          evidenceOpen ? "max-h-[min(40vh,22rem)]" : "max-h-0",
        )}
      >
        <div className="max-h-[min(40vh,22rem)] space-y-3 overflow-y-auto px-3 pb-4 sm:px-4">
          <GroundingBanner grounding={grounding} />
          <HowReachedPanelView
            panel={grounding?.howReached ?? null}
            coverage={grounding?.coverage ?? null}
          />
          {citations.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" aria-hidden />}
              title="No citations yet"
              description="Manual page citations and excerpts appear here after each grounded response. Open a citation to preview the source page."
              className="py-6"
            />
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-2xs uppercase tracking-wide text-garage-muted">
                Manual citations
              </p>
              {citations.map((c, i) => (
                <SourcePageViewer key={`${c.source}-${c.page}-${i}`} citation={c} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
