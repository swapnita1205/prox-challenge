"use client";

import type { EvidenceCoverage, HowReachedPanel } from "@/lib/grounding/schemas";
import { cn } from "@/lib/utils";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface HowReachedPanelProps {
  panel: HowReachedPanel | null;
  coverage: EvidenceCoverage | null;
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section>
      <h4 className="label-caps">
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-garage-muted">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li key={item} className="text-sm text-garage-text">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HowReachedPanelView({ panel, coverage }: HowReachedPanelProps) {
  const [open, setOpen] = useState(false);

  if (!panel) return null;

  const hasContent =
    panel.manualFactsUsed.length > 0 ||
    panel.userObservations.length > 0 ||
    panel.hypothesesConsidered.length > 0 ||
    panel.contradictionsFound.length > 0 ||
    panel.reasonForNextQuestion ||
    panel.confidenceLimitations.length > 0;

  if (!hasContent) return null;

  return (
    <div className="border-t border-garage-border bg-garage-bg">
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between rounded-none px-4 py-3"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="how-reached-panel"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-garage-text">
          <Brain className="h-4 w-4 text-garage-orange" aria-hidden />
          How WeldPilot reached this
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-garage-muted" />
        ) : (
          <ChevronUp className="h-4 w-4 text-garage-muted" />
        )}
      </Button>

      <div
        id="how-reached-panel"
        className={cn("drawer-panel overflow-hidden", open ? "max-h-96" : "max-h-0")}
      >
        <div className="max-h-96 space-y-4 overflow-y-auto px-3 pb-4 sm:px-4">
          {coverage && (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-garage-border bg-garage-panel p-3 text-2xs sm:grid-cols-5">
              <div>
                <span className="text-garage-muted">Claims</span>
                <p className="font-mono text-garage-text">{coverage.claimsMade}</p>
              </div>
              <div>
                <span className="text-garage-muted">Direct</span>
                <p className="font-mono text-emerald-300">{coverage.directEvidence}</p>
              </div>
              <div>
                <span className="text-garage-muted">Indirect</span>
                <p className="font-mono text-sky-300">{coverage.indirectEvidence}</p>
              </div>
              <div>
                <span className="text-garage-muted">Calculated</span>
                <p className="font-mono text-violet-300">{coverage.calculatedEvidence}</p>
              </div>
              <div>
                <span className="text-garage-muted">Unsupported</span>
                <p className="font-mono text-amber-300">{coverage.unsupportedClaims}</p>
              </div>
            </div>
          )}

          <Section
            title="Manual facts used"
            items={panel.manualFactsUsed}
            empty="No manual citations attached to this response."
          />
          <Section
            title="Observations you supplied"
            items={panel.userObservations}
            empty="No user observations recorded."
          />
          <Section
            title="Hypotheses considered"
            items={panel.hypothesesConsidered}
            empty="No diagnostic hypotheses for this turn."
          />
          <Section
            title="Contradictions found"
            items={panel.contradictionsFound}
            empty="No conflicts detected between sources."
          />
          {panel.reasonForNextQuestion && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-garage-muted">
                Reason for next question
              </h4>
              <p className="mt-1 text-sm text-garage-text">{panel.reasonForNextQuestion}</p>
            </section>
          )}
          <Section
            title="Confidence limitations"
            items={panel.confidenceLimitations}
            empty="No additional confidence limits noted."
          />
        </div>
      </div>
    </div>
  );
}
