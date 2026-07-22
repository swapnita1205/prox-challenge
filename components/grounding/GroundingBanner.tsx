"use client";

import type { GroundingResult, GroundingStatus } from "@/lib/grounding/schemas";
import { STATUS_LABELS } from "@/lib/grounding/schemas";
import { useMicroFlash } from "@/lib/ui/micro-interactions";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<
  GroundingStatus,
  { border: string; bg: string; text: string; icon: typeof CheckCircle2 }
> = {
  grounded: {
    border: "border-emerald-500/35",
    bg: "bg-emerald-500/8",
    text: "text-emerald-200",
    icon: CheckCircle2,
  },
  grounded_with_uncertainty: {
    border: "border-amber-500/35",
    bg: "bg-amber-500/8",
    text: "text-amber-200",
    icon: AlertTriangle,
  },
  clarification_required: {
    border: "border-sky-500/35",
    bg: "bg-sky-500/8",
    text: "text-sky-200",
    icon: HelpCircle,
  },
  conflicting_sources: {
    border: "border-orange-500/35",
    bg: "bg-orange-500/8",
    text: "text-orange-200",
    icon: AlertTriangle,
  },
  insufficient_manual_evidence: {
    border: "border-amber-500/35",
    bg: "bg-amber-500/8",
    text: "text-amber-200",
    icon: AlertTriangle,
  },
  blocked_for_safety: {
    border: "border-red-500/35",
    bg: "bg-red-500/8",
    text: "text-red-200",
    icon: ShieldX,
  },
};

interface GroundingBannerProps {
  grounding: GroundingResult | null;
}

export function GroundingBanner({ grounding }: GroundingBannerProps) {
  const conflictFlash = useMicroFlash("config_conflict");

  if (!grounding) return null;

  const style = STATUS_STYLES[grounding.status];
  const Icon = style.icon;
  const showDetails =
    grounding.status !== "grounded" ||
    grounding.warnings.length > 0 ||
    grounding.coverage.unsupportedClaims > 0;

  if (!showDetails) return null;

  return (
    <div
      className={cn(
        "mx-3 mb-2 rounded-md border px-3 py-2.5 sm:mx-4",
        style.border,
        style.bg,
        grounding.status === "conflicting_sources" && conflictFlash && "micro-flash-conflict",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.text)} aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-sm font-medium", style.text)}>
              {STATUS_LABELS[grounding.status]}
            </span>
            <Badge variant="outline" className="font-mono text-2xs tabular-nums">
              {Math.round(grounding.coverage.coverageScore * 100)}% evidence coverage
            </Badge>
          </div>
          {grounding.statusMessage && grounding.status !== "grounded" && (
            <p className="text-sm leading-relaxed text-garage-text">{grounding.statusMessage}</p>
          )}
          {grounding.blockers.length > 0 && (
            <ul className="list-inside list-disc text-sm text-red-200">
              {grounding.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {grounding.warnings.length > 0 && (
            <ul className="list-inside list-disc text-sm text-amber-200/90">
              {grounding.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {grounding.coverage.unsupportedClaims > 0 && (
            <p className="font-mono text-2xs text-garage-muted">
              {grounding.coverage.unsupportedClaims} of {grounding.coverage.claimsMade} claim(s)
              lack manual support.
            </p>
          )}
        </div>
        {grounding.status === "blocked_for_safety" && (
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-300" aria-hidden />
        )}
      </div>
    </div>
  );
}
