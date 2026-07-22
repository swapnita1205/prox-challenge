import type { ConfigurationSummaryArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { ArtifactShell } from "@/components/artifacts/shared/ArtifactShell";

type Spec = z.infer<typeof ConfigurationSummaryArtifactSchema>;

const STATUS_STYLES = {
  verified: "text-emerald-300 border-emerald-500/40",
  partial: "text-amber-200 border-amber-500/40",
  unverified: "text-garage-muted border-garage-border",
  invalid: "text-red-300 border-red-500/40",
};

export function ConfigurationSummaryArtifact({ spec }: { spec: Spec }) {
  return (
    <ArtifactShell {...spec}>
      <div
        className={`inline-flex rounded border px-3 py-1 font-mono text-xs uppercase ${STATUS_STYLES[spec.validationStatus]}`}
      >
        {spec.validationStatus}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label="Process" value={spec.process} />
        {spec.inputVoltage && <Row label="Input voltage" value={`${spec.inputVoltage}V`} />}
        {spec.polarity && <Row label="Polarity" value={spec.polarity} />}
      </dl>

      {spec.consumables.length > 0 && (
        <TagList title="Consumables" items={spec.consumables} />
      )}
      {spec.components.length > 0 && (
        <TagList title="Components" items={spec.components} />
      )}

      {spec.warnings.length > 0 && (
        <ul className="space-y-1 text-sm text-amber-100" role="list">
          {spec.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      {spec.contradictions.length > 0 && (
        <ul className="space-y-1 text-sm text-red-200" role="list">
          {spec.contradictions.map((c) => (
            <li key={c}>✕ {c}</li>
          ))}
        </ul>
      )}
    </ArtifactShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-garage-border bg-garage-bg p-3">
      <dt className="text-xs text-garage-muted">{label}</dt>
      <dd className="font-mono text-garage-text">{value}</dd>
    </div>
  );
}

function TagList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 font-mono text-xs uppercase text-garage-muted">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-full border border-garage-border px-3 py-1 text-xs text-garage-text"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
