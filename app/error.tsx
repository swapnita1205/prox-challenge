"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("WeldPilot error:", error);
  }, [error]);

  return (
    <div
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-center"
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-md border border-garage-orange/30 bg-garage-orange/10">
        <AlertTriangle className="h-7 w-7 text-garage-orange" aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-garage-text">
          Something went wrong
        </h1>
        <p className="text-sm leading-relaxed text-garage-muted">
          {error.message || "An unexpected error occurred in WeldPilot."}
        </p>
        {error.digest && (
          <p className="font-mono text-2xs text-garage-muted">Ref: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
          Try again
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          <Home className="mr-1 h-4 w-4" aria-hidden />
          Go home
        </Button>
      </div>
    </div>
  );
}
