"use client";

import type { ReactNode } from "react";
import { useConversation } from "@/lib/conversation/context";
import { useMachineDetective } from "@/lib/detective/useMachineDetective";
import { useMicroFlash } from "@/lib/ui/micro-interactions";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Gauge,
  ShieldAlert,
  Zap,
} from "lucide-react";

const PROCESS_LABELS: Record<string, string> = {
  mig: "MIG",
  flux: "Flux-Cored",
  tig: "TIG",
  stick: "Stick",
};

function formatProcess(process?: string): string {
  if (!process) return "—";
  return PROCESS_LABELS[process] ?? process.replace(/-/g, " ").toUpperCase();
}

interface StatusCellProps {
  label: string;
  value: string;
  icon: ReactNode;
  highlight?: boolean;
  warning?: boolean;
  className?: string;
}

function StatusCell({
  label,
  value,
  icon,
  highlight,
  warning,
  className,
}: StatusCellProps) {
  return (
    <div
      className={cn(
        "flex min-w-[7.5rem] shrink-0 items-center gap-2 border-r border-garage-border/60 px-3 py-2 last:border-r-0",
        highlight && "bg-garage-orange/5",
        warning && "bg-amber-500/5",
        className,
      )}
    >
      <span className="text-garage-muted" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-garage-muted">
          {label}
        </p>
        <p
          className={cn(
            "truncate font-mono text-sm font-semibold tabular-nums",
            warning ? "text-amber-200" : "text-garage-text",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export function StatusStrip() {
  const { conversation, grounding } = useConversation();
  const { session } = useMachineDetective(conversation.id);
  const confidenceFlash = useMicroFlash("confidence_change");
  const conflictFlash = useMicroFlash("config_conflict");

  const { process, inputVoltage } = conversation.machineState;

  const diagnosticConfidence = session?.diagnosticConfidence;
  const confidenceLabel =
    diagnosticConfidence != null
      ? `${Math.round(diagnosticConfidence * 100)}%`
      : grounding
        ? `${Math.round(grounding.coverage.coverageScore * 100)}% cov.`
        : "—";

  const safetyCount =
    (grounding?.warnings.length ?? 0) + (grounding?.blockers.length ?? 0);
  const safetyBlocked = grounding?.status === "blocked_for_safety";
  const safetyLabel =
    safetyBlocked
      ? "Blocked"
      : safetyCount > 0
        ? `${safetyCount} active`
        : "Clear";

  return (
    <div
      className="border-b border-garage-border bg-garage-bg/80 backdrop-blur-sm"
      role="status"
      aria-label="Machine status"
    >
      <div className="flex overflow-x-auto scrollbar-thin">
        <StatusCell
          label="Process"
          value={formatProcess(process)}
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <StatusCell
          label="Input"
          value={inputVoltage ? `${inputVoltage} V` : "—"}
          icon={<Zap className="h-3.5 w-3.5" />}
        />
        <StatusCell
          label="Confidence"
          value={confidenceLabel}
          icon={<Gauge className="h-3.5 w-3.5" />}
          highlight
          className={cn(confidenceFlash && "micro-flash-confidence")}
        />
        <StatusCell
          label="Safety"
          value={safetyLabel}
          icon={
            safetyBlocked || safetyCount > 0 ? (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )
          }
          warning={safetyBlocked || safetyCount > 0}
          className={cn(conflictFlash && "micro-flash-conflict")}
        />
      </div>
    </div>
  );
}
