"use client";

import { useState } from "react";
import type { StepByStepChecklistArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";

type Spec = z.infer<typeof StepByStepChecklistArtifactSchema>;

export function StepByStepChecklistArtifact({ spec }: { spec: Spec }) {
  const [steps, setSteps] = useState(spec.steps);

  const toggle = (id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)),
    );
  };

  const done = steps.filter((s) => s.completed).length;

  return (
    <ArtifactShell {...spec}>
      <p className="font-mono text-xs text-garage-muted">
        {done} / {steps.length} complete
      </p>
      <ol className="space-y-2" role="list">
        {steps.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => toggle(step.id)}
              className={`flex w-full gap-3 rounded-lg border p-3 text-left transition ${
                step.completed
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : step.safetyCritical
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-garage-border bg-garage-bg hover:border-garage-orange/40"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
                  step.completed ? "bg-emerald-500 text-garage-bg" : "bg-garage-panel text-garage-muted"
                }`}
              >
                {step.completed ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm ${
                    step.completed ? "text-garage-muted line-through" : "text-garage-text"
                  }`}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className="mt-1 block text-xs text-garage-muted">{step.detail}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </ArtifactShell>
  );
}
