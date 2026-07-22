"use client";

import { useState } from "react";
import type { SettingsConfiguratorArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";
import { PolarityDiagramArtifact } from "@/components/artifacts/renderers/PolarityDiagramArtifact";

type Spec = z.infer<typeof SettingsConfiguratorArtifactSchema>;

export function SettingsConfiguratorArtifact({ spec }: { spec: Spec }) {
  const [process, setProcess] = useState(spec.process ?? "mig");
  const [material, setMaterial] = useState(spec.material ?? "Mild Steel");
  const [thickness, setThickness] = useState(spec.thickness ?? '1/8"');

  const polarityMini =
    spec.polarityRef && process === "mig"
      ? {
          type: "polarity-diagram" as const,
          title: "Polarity reference",
          process: "mig-solid" as const,
          polarityType: spec.polarityRef.polarityType,
          groundSocket: (spec.polarityRef.groundSocket === "torch"
            ? "negative"
            : spec.polarityRef.groundSocket) as "positive" | "negative" | "workpiece",
          electrodeSocket: (spec.polarityRef.electrodeSocket === "workpiece"
            ? "positive"
            : spec.polarityRef.electrodeSocket) as "positive" | "negative" | "torch",
          groundLabel: "Ground Clamp",
          electrodeLabel: "MIG Gun",
          citations: spec.citations,
        }
      : null;

  return (
    <ArtifactShell {...spec}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Process" value={process} onChange={(v) => setProcess(v as typeof process)} options={["mig", "flux", "tig", "stick"]} />
            <Select label="Material" value={material} onChange={setMaterial} options={["Mild Steel", "Stainless Steel", "Aluminum"]} />
            <Select label="Thickness" value={thickness} onChange={setThickness} options={['1/16"', '1/8"', '3/16"', '1/4"']} />
            {spec.inputVoltage && (
              <div className="rounded border border-garage-border bg-garage-bg px-3 py-2">
                <div className="text-xs text-garage-muted">Input voltage</div>
                <div className="font-mono text-garage-text">{spec.inputVoltage}V</div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-garage-border bg-garage-bg p-4">
            <p className="mb-2 font-mono text-xs uppercase text-garage-muted">Recommended</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <Item label="Voltage" value={spec.recommended?.voltage} />
              <Item label="Wire speed" value={spec.recommended?.wireSpeed} />
              <Item label="Amperage" value={spec.recommended?.amperage} />
              <Item label="Gas / flow" value={spec.recommended?.gasFlow ?? spec.gas} />
              <Item label="Wire" value={spec.wireDiameter ?? spec.wireType} />
              <Item label="Polarity" value={spec.recommended?.polarity ?? spec.polarityRef?.polarityType} />
            </dl>
            {spec.recommended?.thicknessOriginal && (
              <p className="mt-2 text-xs text-garage-muted">
                Thickness: {spec.recommended.thicknessOriginal}
                {spec.recommended.thicknessNormalized
                  ? ` → chart row ${spec.recommended.thicknessNormalized}`
                  : ""}
              </p>
            )}
            {spec.recommended?.recommendationStatus && (
              <p className="mt-1 font-mono text-2xs uppercase text-garage-muted">
                Status: {spec.recommended.recommendationStatus.replace(/_/g, " ")}
              </p>
            )}
            {spec.recommended?.notes && (
              <p className="mt-2 text-xs text-garage-muted">{spec.recommended.notes}</p>
            )}
          </div>

          {spec.supportingEvidence.length > 0 && (
            <ul className="space-y-1 text-xs text-garage-muted" role="list">
              {spec.supportingEvidence.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          {spec.setupChecklist.length > 0 && (
            <div className="rounded-lg border border-garage-border p-3">
              <p className="mb-2 font-mono text-xs uppercase text-garage-muted">Setup checklist</p>
              <ul className="space-y-2" role="list">
                {spec.setupChecklist.map((step) => (
                  <li key={step.id} className="flex gap-2 text-sm">
                    <span className={step.completed ? "text-emerald-400" : "text-garage-muted"}>
                      {step.completed ? "✓" : "○"}
                    </span>
                    <span className={step.completed ? "text-garage-muted line-through" : "text-garage-text"}>
                      {step.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {polarityMini && (
            <div className="scale-[0.95] origin-top">
              <PolarityDiagramArtifact spec={polarityMini} />
            </div>
          )}
        </div>
      </div>
    </ArtifactShell>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-garage-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-garage-border bg-garage-bg px-2 py-2 text-sm text-garage-text"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Item({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-garage-muted">{label}</dt>
      <dd className="font-mono text-garage-text">{value ?? "—"}</dd>
    </div>
  );
}
