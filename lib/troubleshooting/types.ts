export interface SourceEvidence {
  source: string;
  page: number;
  section?: string;
  assetId?: string;
  excerpt?: string;
}

export interface VisualEvidence {
  source: string;
  page: number;
  assetId?: string;
  caption?: string;
}

export interface NormalizedTroubleshootingRecord {
  id: string;
  symptom: string;
  process: string[];
  materialContext?: string;
  possibleCause: string[];
  diagnosticCheck: string[];
  correctiveAction: string[];
  safetyPrerequisites: string[];
  sourceEvidence: SourceEvidence[];
  visualEvidence: VisualEvidence[];
  requiredConfiguration?: string[];
  aliases: string[];
}
