"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getPageRenderPath } from "@/lib/retrieval/search";

interface ManualFigureImageProps {
  assetPath: string;
  source: string;
  page: number;
  alt: string;
  className?: string;
  fallbackNote?: string;
  onFallbackNote?: (note: string) => void;
}

/**
 * Manual figure image with client-side page-render fallback when the
 * primary asset 404s or fails to load.
 */
export function ManualFigureImage({
  assetPath,
  source,
  page,
  alt,
  className = "object-contain p-3 sm:p-4",
  fallbackNote,
  onFallbackNote,
}: ManualFigureImageProps) {
  const pageFallback = useMemo(() => getPageRenderPath(source, page), [source, page]);
  const [src, setSrc] = useState(assetPath);
  const [usedFallback, setUsedFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(assetPath);
    setUsedFallback(false);
    setFailed(false);
  }, [assetPath]);

  const handleError = useCallback(() => {
    if (!usedFallback && src !== pageFallback) {
      setUsedFallback(true);
      setSrc(pageFallback);
      onFallbackNote?.(
        "Cropped figure asset unavailable — showing full manual page render instead.",
      );
      return;
    }
    setFailed(true);
  }, [usedFallback, src, pageFallback, onFallbackNote]);

  if (failed) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 bg-garage-panel p-4 text-center">
        <p className="text-sm text-garage-muted">Manual image could not be loaded.</p>
        <p className="font-mono text-2xs text-garage-muted">
          {source} · page {page}
        </p>
        {(fallbackNote || usedFallback) && (
          <p className="mt-1 max-w-sm rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
            {fallbackNote ??
              "Cropped figure asset unavailable — page render also failed to load."}
          </p>
        )}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      unoptimized
      onError={handleError}
    />
  );
}
