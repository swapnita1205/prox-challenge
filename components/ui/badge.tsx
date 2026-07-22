import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "outline" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-garage-orange/20 text-garage-orange": variant === "default",
          "border border-garage-border text-garage-muted": variant === "outline",
          "bg-garage-bg text-garage-muted": variant === "muted",
        },
        className,
      )}
      {...props}
    />
  );
}
