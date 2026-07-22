"use client";

import { Printer } from "lucide-react";

interface PrintSummaryButtonProps {
  title: string;
}

export function PrintSummaryButton({ title }: PrintSummaryButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1 rounded border border-garage-border bg-garage-panel px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-garage-muted transition hover:border-garage-orange hover:text-garage-orange"
      aria-label={`Print ${title}`}
    >
      <Printer className="h-3 w-3" aria-hidden />
      Print
    </button>
  );
}
