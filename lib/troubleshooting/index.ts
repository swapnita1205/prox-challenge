export type { NormalizedTroubleshootingRecord, SourceEvidence, VisualEvidence } from "@/lib/troubleshooting/types";
export {
  DOMAIN_SYNONYMS,
  aliasTermsFor,
  expandQueryTerms,
  matchCanonicalInText,
  resolveCanonicalTerm,
} from "@/lib/troubleshooting/synonyms";
export {
  buildSearchText,
  findRecordsMatchingQuery,
  getNormalizedTroubleshootingRecords,
  resetTroubleshootingRecordsCache,
} from "@/lib/troubleshooting/normalize";
