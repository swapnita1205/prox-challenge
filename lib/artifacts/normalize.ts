import type { ArtifactSpec } from "@/lib/schemas/artifacts/types";
import { ArtifactSpecSchema } from "@/lib/schemas/artifacts/types";

const LEGACY_TYPE_MAP: Record<string, ArtifactSpec["type"]> = {
  polarity_diagram: "polarity-diagram",
  polarityDiagram: "polarity-diagram",
  duty_cycle_calculator: "duty-cycle-calculator",
  duty_calculator: "duty-cycle-calculator",
  settings_configurator: "settings-configurator",
  troubleshooting_flowchart: "troubleshooting-flow",
  hypothesis_panel: "diagnostic-hypothesis-board",
  manual_image: "manual-figure",
  manualImage: "manual-figure",
  annotated_manual_figure: "annotated-manual-figure",
  annotated_manual_image: "annotated-manual-figure",
  component_map: "component-map",
  setup_checklist: "step-by-step-checklist",
  checklist: "step-by-step-checklist",
};

/** Parse `manual-assets/owner-manual/p08.png` → source + page. */
export function provenanceFromAssetId(
  assetId: string,
): { source: string; page: number } | null {
  const match = assetId.match(
    /(?:manual-assets\/)?([a-z0-9-]+)\/p0*(\d+)\.(?:png|jpe?g|webp)$/i,
  );
  if (!match) return null;
  const slug = match[1]!;
  const page = Number(match[2]);
  if (!Number.isFinite(page)) return null;
  const source = slug.endsWith(".pdf") ? slug : `${slug}.pdf`;
  return { source, page };
}

function socketFromConnectionValue(value: unknown): string | undefined {
  const s = String(value ?? "").toLowerCase();
  if (/positive|\+/.test(s)) return "positive";
  if (/negative|-/.test(s)) return "negative";
  if (/torch|electrode/.test(s)) return "torch";
  if (/work|ground|clamp/.test(s)) return "workpiece";
  return undefined;
}

function coerceSpecObject(spec: unknown): Record<string, unknown> | null {
  if (typeof spec === "string") {
    try {
      const parsed = JSON.parse(spec) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (spec && typeof spec === "object" && !Array.isArray(spec)) {
    return spec as Record<string, unknown>;
  }
  return null;
}

function migrateLegacySpec(raw: Record<string, unknown>): Record<string, unknown> {
  const typeRaw = (raw.type ?? raw.kind ?? raw.artifactType) as string | undefined;
  let mappedType: string | undefined = typeRaw
    ? (LEGACY_TYPE_MAP[typeRaw] ?? typeRaw)
    : undefined;

  if (
    (typeRaw === "calculator" || mappedType === "calculator") &&
    /duty/i.test(String(raw.subtype ?? raw.kind ?? ""))
  ) {
    mappedType = "duty-cycle-calculator";
  }

  const next: Record<string, unknown> = { ...raw };
  if (mappedType) next.type = mappedType;
  delete next.kind;
  delete next.artifactType;

  if (mappedType === "polarity-diagram" || typeRaw === "polarity_diagram") {
    next.groundLabel = next.groundLabel ?? "Ground Clamp";
    next.electrodeLabel = next.electrodeLabel ?? "Electrode / Torch";

    if (
      (!next.groundSocket || !next.electrodeSocket) &&
      Array.isArray(raw.connections)
    ) {
      for (const conn of raw.connections as Array<Record<string, unknown>>) {
        const cable = String(conn.cable ?? conn.from ?? conn.label ?? "").toLowerCase();
        const socket =
          socketFromConnectionValue(conn.socket ?? conn.to ?? conn.polarity) ??
          socketFromConnectionValue(conn);
        if (!socket) continue;
        if (/ground|work|clamp/.test(cable) && !next.groundSocket) {
          next.groundSocket = socket === "torch" ? "positive" : socket;
        }
        if (/electrode|torch|gun|stinger/.test(cable) && !next.electrodeSocket) {
          next.electrodeSocket = socket === "workpiece" ? "negative" : socket;
        }
      }
    }

    if (!next.process && typeof raw.process === "string") {
      next.process = String(raw.process).toLowerCase();
    }
  }

  if (typeRaw === "hypothesis_panel" && Array.isArray(raw.hypotheses)) {
    next.hypotheses = (raw.hypotheses as Array<Record<string, unknown>>).map((h) => ({
      id: h.id,
      label: h.label,
      confidence: h.posterior ?? h.confidence ?? 0.5,
      evidenceFor: h.evidence ?? h.evidenceFor ?? [],
      evidenceAgainst: h.evidenceAgainst ?? [],
      ruledOut: h.ruledOut,
    }));
    next.title = next.title ?? "Diagnostic Hypotheses";
  }

  if (typeRaw === "troubleshooting_flowchart") {
    next.currentQuestion =
      next.currentQuestion ??
      (Array.isArray(raw.nodes)
        ? (raw.nodes as Array<{ label: string }>).find((n) => n)?.label
        : "What symptom are you seeing?");
    next.branches = (raw.nodes as Array<Record<string, unknown>> | undefined)?.map((n) => ({
      id: n.id,
      label: n.label,
      kind: n.kind ?? "question",
      nextId: undefined,
    }));
    next.observations = next.observations ?? [];
    next.eliminatedCauses = next.eliminatedCauses ?? [];
  }

  if (
    mappedType === "manual-figure" ||
    mappedType === "annotated-manual-figure" ||
    typeRaw === "manual_image" ||
    typeRaw === "manualImage"
  ) {
    next.title = next.title ?? raw.caption ?? "Manual Figure";
    next.caption =
      next.caption ??
      raw.caption ??
      next.title ??
      (typeof raw.label === "string" ? raw.label : "Manual figure");

    const assetId = typeof next.assetId === "string" ? next.assetId : undefined;
    if (assetId) {
      const prov = provenanceFromAssetId(assetId);
      if (prov) {
        if (!next.source) next.source = prov.source;
        if (next.page == null) next.page = prov.page;
      }
    }

    // Callouts/regions imply annotated figure, not plain manual-figure.
    const hasCallouts =
      Array.isArray(raw.callouts) && (raw.callouts as unknown[]).length > 0;
    const hasRegions =
      Array.isArray(raw.regions) && (raw.regions as unknown[]).length > 0;
    if (
      (hasCallouts || hasRegions) &&
      (mappedType === "manual-figure" ||
        typeRaw === "manual_image" ||
        typeRaw === "manualImage")
    ) {
      next.type = "annotated-manual-figure";
      mappedType = "annotated-manual-figure";
      if (!Array.isArray(next.regions)) next.regions = raw.regions ?? [];
      if (!Array.isArray(next.callouts)) next.callouts = raw.callouts ?? [];
    }
  }

  if (
    mappedType === "step-by-step-checklist" ||
    typeRaw === "setup_checklist" ||
    typeRaw === "checklist"
  ) {
    if (!next.steps && Array.isArray(raw.items)) {
      next.steps = (raw.items as Array<Record<string, unknown> | string>).map((item, i) => {
        if (typeof item === "string") {
          return { id: `step-${i + 1}`, label: item };
        }
        return {
          id: String(item.id ?? `step-${i + 1}`),
          label: String(item.label ?? item.text ?? item.detail ?? `Step ${i + 1}`),
        };
      });
    }
    next.steps = next.steps ?? raw.steps;
  }

  if (mappedType === "duty-cycle-calculator") {
    next.title =
      next.title ??
      `Duty Cycle — ${String(raw.process ?? "MIG").toUpperCase()} @ ${raw.voltage ?? raw.inputVoltage ?? ""}V`;
    if (next.voltage == null && raw.inputVoltage != null) next.voltage = raw.inputVoltage;
    if (next.defaultAmps == null && (raw.amps != null || raw.requestedAmps != null)) {
      next.defaultAmps = raw.amps ?? raw.requestedAmps;
    }
    if (next.ratedDutyPercent == null && raw.dutyPercent != null) {
      next.ratedDutyPercent = raw.dutyPercent;
    }
    if (next.ratedAmps == null && raw.ratedAmps != null) next.ratedAmps = raw.ratedAmps;
  }

  if (mappedType === "settings-configurator" || typeRaw === "settings_configurator") {
    next.title = next.title ?? "Settings Configurator";
    next.setupChecklist = next.setupChecklist ?? [];
    next.supportingEvidence = next.supportingEvidence ?? [];
  }

  if (!next.title && typeof next.caption === "string") {
    next.title = next.caption;
  }

  if (!next.citations) next.citations = [];

  return next;
}

export function normalizeArtifactSpec(spec: unknown): ArtifactSpec | null {
  const raw = coerceSpecObject(spec);
  if (!raw) return null;
  const migrated = migrateLegacySpec(raw);
  const result = ArtifactSpecSchema.safeParse(migrated);
  return result.success ? result.data : null;
}
