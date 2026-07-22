"use client";

import { Search, CheckCircle2, Brain, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressStepView } from "@/lib/conversation/context";

const ICONS: Record<ProgressStepView["icon"], LucideIcon> = {
  search: Search,
  found: CheckCircle2,
  reasoning: Brain,
  artifact: Sparkles,
};

interface ProgressStatusProps {
  steps: ProgressStepView[];
  /** False fades the component out once the answer starts streaming. */
  visible: boolean;
}

/**
 * Dedicated, transient status component shown above the streaming answer
 * while the agent searches, reasons, and prepares artifacts. These steps
 * are UI-only events — they are never part of the final assistant message.
 */
export function ProgressStatus({ steps, visible }: ProgressStatusProps) {
  if (steps.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-2 ml-[2.625rem] max-w-[85%] overflow-hidden rounded-lg border border-garage-border bg-garage-panel/60 transition-all duration-300 ease-out sm:ml-[2.75rem] sm:max-w-[85%]",
        visible
          ? "max-h-40 px-3 py-2 opacity-100"
          : "max-h-0 border-transparent px-3 py-0 opacity-0",
      )}
      role="status"
      aria-live="polite"
      aria-label="Assistant progress"
    >
      <ul className="space-y-1">
        {steps.map((step, i) => {
          const Icon = ICONS[step.icon];
          const isActive = i === steps.length - 1;
          return (
            <li
              key={`${i}-${step.icon}-${step.message}`}
              className={cn(
                "flex items-center gap-1.5 text-2xs sm:text-xs",
                isActive ? "text-garage-text" : "text-garage-muted",
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isActive ? "animate-pulse text-garage-orange" : "text-garage-muted",
                )}
                aria-hidden
              />
              <span>{step.message}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
