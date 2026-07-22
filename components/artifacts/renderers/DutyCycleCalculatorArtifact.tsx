"use client";

import { useMemo, useState } from "react";
import type { DutyCycleCalculatorArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";
import { calculateDutyCycle } from "@/lib/agent/calculations/duty-cycle";

type Spec = z.infer<typeof DutyCycleCalculatorArtifactSchema>;

export function DutyCycleCalculatorArtifact({ spec }: { spec: Spec }) {
  const [amps, setAmps] = useState(spec.defaultAmps ?? spec.ratedAmps ?? 100);

  const result = useMemo(
    () =>
      calculateDutyCycle({
        process: spec.process,
        inputVoltage: spec.voltage,
        amps,
      }),
    [spec.process, spec.voltage, amps],
  );

  const maxAmps = spec.voltage === 120 ? 140 : 220;
  const outOfRange = amps > maxAmps;
  const weldPct = result.applicableDutyPercent ?? 0;
  const weldMin = result.weldMinutesPer10 ?? 0;
  const restMin = result.restMinutesPer10 ?? 0;

  return (
    <ArtifactShell {...spec}>
      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm text-garage-muted">Welding current (amps)</span>
          <input
            type="range"
            min={10}
            max={maxAmps}
            value={amps}
            onChange={(e) => setAmps(Number(e.target.value))}
            className="w-full accent-garage-orange"
          />
          <span className="font-mono text-xl text-garage-text">{amps} A</span>
        </label>

        {outOfRange && (
          <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Requested amperage exceeds documented range for {spec.voltage}V {spec.process.toUpperCase()}.
          </p>
        )}

        {result.ratedEntry ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Rated duty" value={`${result.applicableDutyPercent}%`} />
              <Stat label="At amps" value={`${result.applicableRatedAmps}A`} />
              <Stat label="Weld / 10 min" value={`${weldMin.toFixed(1)} min`} highlight />
              <Stat label="Cool / 10 min" value={`${restMin.toFixed(1)} min`} />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-mono text-xs text-garage-muted">
                <span>0 min</span>
                <span>10 min cycle</span>
              </div>
              <div className="flex h-8 overflow-hidden rounded-lg border border-garage-border">
                <div
                  className="flex items-center justify-center bg-garage-orange/80 text-xs font-medium text-garage-bg transition-all duration-500"
                  style={{ width: `${weldPct}%` }}
                >
                  {weldPct > 15 ? "Weld" : ""}
                </div>
                <div
                  className="flex flex-1 items-center justify-center bg-garage-panel text-xs text-garage-muted transition-all duration-500"
                >
                  Rest / cool
                </div>
              </div>
            </div>

            <p className="text-sm text-garage-text">{result.message}</p>
          </>
        ) : (
          <p className="text-sm text-amber-200">
            No verified duty-cycle data for this configuration in the manual index.
          </p>
        )}
      </div>
    </ArtifactShell>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 text-center ${
        highlight ? "border-garage-orange/40 bg-garage-orange/10" : "border-garage-border bg-garage-bg"
      }`}
    >
      <div className={`font-mono text-lg ${highlight ? "text-garage-orange" : "text-garage-text"}`}>
        {value}
      </div>
      <div className="text-xs text-garage-muted">{label}</div>
    </div>
  );
}
