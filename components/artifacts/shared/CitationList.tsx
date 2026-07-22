import type { Citation } from "@/lib/schemas/conversation";

interface CitationListProps {
  citations: Citation[];
}

export function CitationList({ citations }: CitationListProps) {
  if (citations.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="font-mono text-xs font-medium uppercase tracking-wide text-garage-muted">
        Citations
      </p>
      <ul className="space-y-1" role="list">
        {citations.map((c, i) => (
          <li key={`${c.source}-${c.page}-${i}`} className="font-mono text-xs text-garage-muted">
            {c.source} p.{c.page}
            {c.section ? ` — ${c.section}` : ""}
            {c.excerpt ? `: ${c.excerpt.slice(0, 120)}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
