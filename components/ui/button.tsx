import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garage-orange focus-visible:ring-offset-2 focus-visible:ring-offset-garage-bg disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-garage-orange text-white hover:bg-garage-orange-dim":
              variant === "default",
            "border border-garage-border bg-garage-panel text-garage-text hover:bg-garage-bg":
              variant === "outline",
            "text-garage-text hover:bg-garage-panel": variant === "ghost",
            "bg-red-600 text-white hover:bg-red-700": variant === "destructive",
            "h-10 px-4 py-2 text-sm": size === "default",
            "h-8 rounded-md px-3 text-xs": size === "sm",
            "h-12 rounded-md px-6 text-base": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
