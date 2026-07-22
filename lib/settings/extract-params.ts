import { extractQueryDimensions } from "@/lib/retrieval/dimensions";
import type { SettingsLookupInput, SettingsProcess } from "@/lib/settings/schemas";
import { parseThickness } from "@/lib/settings/thickness";

export interface ExtractedSettingsParams {
  process?: SettingsProcess;
  material?: string;
  thickness?: string;
  thicknessNormalized?: ReturnType<typeof parseThickness>;
  inputVoltage?: 120 | 240;
  wireType?: string;
  wireDiameter?: string;
  shieldingGas?: string;
}

function normalizeProcess(raw?: string): SettingsProcess | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (/flux/.test(lower)) return "flux";
  if (/tig|gtaw/.test(lower)) return "tig";
  if (/stick|smaw/.test(lower)) return "stick";
  if (/mig|solid/.test(lower)) return "mig";
  return undefined;
}

function normalizeMaterial(raw?: string): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (/mild\s*steel/.test(lower)) return "Mild Steel";
  if (/stainless/.test(lower)) return "Stainless Steel";
  if (/alumin/.test(lower)) return "Aluminum";
  if (/chrome\s*moly/.test(lower)) return "Chrome Moly";
  return raw.trim();
}

/** Merge structured tool/wizard input with query-derived dimensions. Structured fields win. */
export function extractSettingsParams(input: SettingsLookupInput): ExtractedSettingsParams {
  const fromQuery = input.query ? extractQueryDimensions(input.query) : null;

  const process =
    normalizeProcess(input.process) ??
    (fromQuery?.processes[0] as SettingsProcess | undefined);

  const material =
    normalizeMaterial(input.material) ?? normalizeMaterial(fromQuery?.material);

  const thicknessRaw = input.thickness ?? fromQuery?.thickness;
  const thicknessNormalized = parseThickness(thicknessRaw ?? input.query ?? "");

  const inputVoltage = input.inputVoltage ?? fromQuery?.inputVoltage;

  const wireType =
    input.wireType ??
    fromQuery?.wireType ??
    (process === "flux" ? undefined : process === "mig" ? "solid core" : undefined);

  const wireDiameter = input.wireDiameter ?? fromQuery?.wireDiameter;
  const shieldingGas = input.shieldingGas ?? fromQuery?.shieldingGas;

  return {
    process,
    material,
    thickness: thicknessRaw ?? thicknessNormalized?.original,
    thicknessNormalized: thicknessNormalized ?? undefined,
    inputVoltage,
    wireType,
    wireDiameter,
    shieldingGas,
  };
}
