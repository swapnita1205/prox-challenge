"use client";

import { useState } from "react";
import Image from "next/image";
import type { Citation } from "@/lib/schemas/conversation";
import { getPageRenderPath } from "@/lib/retrieval/search";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SourcePageViewerProps {
  citation: Citation;
  defaultOpen?: boolean;
}

export function SourcePageViewer({ citation, defaultOpen = false }: SourcePageViewerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const assetPath = getPageRenderPath(citation.source, citation.page);

  return (
    <article className="rounded-md border border-garage-border bg-garage-panel transition-colors hover:border-garage-border-bright">
      <header className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-medium text-garage-orange">
              {citation.source} p.{citation.page}
            </span>
            {citation.section && (
              <span className="truncate text-xs text-garage-muted">
                {citation.section}
              </span>
            )}
          </div>
          {citation.excerpt && (
            <p className="mt-2 text-sm leading-relaxed text-garage-text">
              {citation.excerpt}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`source-page-${citation.source}-${citation.page}`}
          className="shrink-0"
        >
          <FileImage className="mr-1 h-3 w-3" aria-hidden />
          {open ? "Hide page" : "View page"}
          {open ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : (
            <ChevronDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      </header>

      <div
        id={`source-page-${citation.source}-${citation.page}`}
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          open ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="border-t border-garage-border px-3 pb-3 pt-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-garage-border bg-garage-bg">
            <Image
              src={assetPath}
              alt={`Manual page ${citation.page} from ${citation.source}`}
              fill
              className="object-contain p-2"
              unoptimized
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-garage-muted">
            Source page · {citation.source}
          </p>
        </div>
      </div>
    </article>
  );
}
