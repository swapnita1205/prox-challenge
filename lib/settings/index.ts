export { resolveSettings } from "@/lib/settings/resolve";
export { extractSettingsParams } from "@/lib/settings/extract-params";
export { buildSettingsNaturalLanguageAnswer } from "@/lib/settings/answer";
export { buildSettingsConfiguratorArtifact } from "@/lib/settings/artifact";
export { parseThickness, matchChartLabel, formatThicknessForAnswer } from "@/lib/settings/thickness";
export type {
  SettingsResolution,
  SettingsLookupInput,
  SettingsSourceRecord,
  RecommendationStatus,
  SettingsProcess,
} from "@/lib/settings/schemas";
