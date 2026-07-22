import type { NormalizedTroubleshootingRecord } from "@/lib/troubleshooting/types";
import type {
  CorpusDocument,
  FormattedCitation,
  RetrievalBundle,
  RetrievalMetadata,
  RetrievedItem,
} from "@/lib/retrieval/types";
import type { Citation } from "@/lib/schemas/conversation";

export function assetIdFromSource(source: string, page: number): string {
  const slug = source.replace(/\.pdf$/i, "");
  return `manual-assets/${slug}/p${String(page).padStart(2, "0")}.png`;
}

export function formatCitation(
  id: string,
  metadata: RetrievalMetadata,
  excerpt?: string,
  confidence?: number,
): FormattedCitation {
  return {
    id,
    source: metadata.source,
    page: metadata.page,
    section: metadata.section,
    assetId: metadata.assetId ?? assetIdFromSource(metadata.source, metadata.page),
    assetPath: metadata.assetPath,
    excerpt: excerpt?.slice(0, 300),
    confidence,
    verified: metadata.verified,
  };
}

export function citationFromDocument(doc: CorpusDocument, excerpt?: string): FormattedCitation {
  return formatCitation(doc.id, doc.metadata, excerpt ?? doc.text.slice(0, 300));
}

/** Emit one citation per sourceEvidence page on structured troubleshooting records. */
export function supplementaryCitationsFromItem(item: RetrievedItem): FormattedCitation[] {
  if (item.corpusType !== "troubleshooting") return [];

  const record = item.payload as NormalizedTroubleshootingRecord | undefined;
  if (!record?.sourceEvidence?.length) return [];

  const seenPages = new Set<string>();
  const citations: FormattedCitation[] = [];

  for (const [idx, evidence] of record.sourceEvidence.entries()) {
    const pageKey = `${evidence.source}:${evidence.page}`;
    if (seenPages.has(pageKey)) continue;
    seenPages.add(pageKey);

    if (
      idx === 0 &&
      evidence.page === item.metadata.page &&
      evidence.source === item.metadata.source
    ) {
      continue;
    }

    citations.push(
      formatCitation(
        `${item.id}-evidence-p${evidence.page}`,
        {
          source: evidence.source,
          page: evidence.page,
          section: evidence.section,
          assetId: evidence.assetId ?? assetIdFromSource(evidence.source, evidence.page),
          verified: item.metadata.verified,
          processes: item.metadata.processes,
        },
        evidence.excerpt,
      ),
    );
  }

  return citations;
}

export function formatCitationLine(citation: FormattedCitation): string {
  const section = citation.section ? ` — ${citation.section}` : "";
  const verified = citation.verified ? " [verified]" : " [unverified]";
  return `${citation.source} p.${citation.page}${section}${verified}`;
}

export function bundleToCitations(bundle: RetrievalBundle): Citation[] {
  return bundle.citations.map((c) => ({
    source: c.source,
    page: c.page,
    section: c.section,
    excerpt: c.excerpt,
    assetId: c.assetId,
  }));
}
