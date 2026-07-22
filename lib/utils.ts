import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    setup: "Setup My Welder",
    diagnose: "Diagnose My Weld",
    settings: "Find My Settings",
    manual: "Ask the Manual",
  };
  return labels[mode] ?? mode;
}
