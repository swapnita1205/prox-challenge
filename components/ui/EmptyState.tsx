import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-garage-border/80 bg-garage-bg/50 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-garage-border bg-garage-panel text-garage-muted">
        {icon}
      </div>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-sm font-semibold tracking-tight text-garage-text">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-garage-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
