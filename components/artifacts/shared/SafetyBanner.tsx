import { AlertTriangle } from "lucide-react";

interface SafetyBannerProps {
  message: string;
}

export function SafetyBanner({ message }: SafetyBannerProps) {
  return (
    <div
      className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
