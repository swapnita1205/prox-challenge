"use client";

import type { ReactNode } from "react";
import type { ArtifactMeta } from "@/lib/schemas/artifacts/base";
import { CitationList } from "@/components/artifacts/shared/CitationList";
import { SafetyBanner } from "@/components/artifacts/shared/SafetyBanner";
import { PrintSummaryButton } from "@/components/artifacts/shared/PrintSummaryButton";
import { ConfidenceBadge } from "@/components/artifacts/shared/ConfidenceBadge";

interface ArtifactShellProps extends ArtifactMeta {
  children: ReactNode;
  printable?: boolean;
  className?: string;
}

export function ArtifactShell({
  title,
  description,
  citations = [],
  safetyNotice,
  confidence,
  provenance,
  children,
  printable = true,
  className = "",
}: ArtifactShellProps) {
  return (
    <article
      className={`artifact-printable artifact-fade-in space-y-4 ${className}`}
      aria-label={title}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wide text-garage-orange">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-garage-muted">{description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confidence && <ConfidenceBadge confidence={confidence} />}
          {printable && <PrintSummaryButton title={title} />}
        </div>
      </header>

      {safetyNotice && <SafetyBanner message={safetyNotice} />}

      <div className="artifact-body">{children}</div>

      <footer className="artifact-footer space-y-2 border-t border-garage-border pt-3">
        <CitationList citations={citations} />
        {provenance && (
          <p className="font-mono text-xs text-garage-muted">
            Source: {provenance.source}
            {provenance.verified ? " · verified" : " · unverified"}
            {provenance.extractionMethod ? ` · ${provenance.extractionMethod}` : ""}
          </p>
        )}
      </footer>
    </article>
  );
}
