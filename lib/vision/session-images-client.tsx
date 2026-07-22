"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface SessionImageEntry {
  previewUrl: string;
  mimeType: string;
}

interface SessionImagesContextValue {
  registerImage: (imageId: string, previewUrl: string, mimeType: string) => void;
  getImageUrl: (imageId: string) => string | undefined;
  clearImages: () => void;
}

const SessionImagesContext = createContext<SessionImagesContextValue | null>(null);

export function SessionImagesProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<Record<string, SessionImageEntry>>({});

  const registerImage = useCallback((imageId: string, previewUrl: string, mimeType: string) => {
    setImages((prev) => ({ ...prev, [imageId]: { previewUrl, mimeType } }));
  }, []);

  const getImageUrl = useCallback(
    (imageId: string) => {
      const local = images[imageId]?.previewUrl;
      if (local) return local;
      return undefined;
    },
    [images],
  );

  const clearImages = useCallback(() => {
    setImages((prev) => {
      for (const entry of Object.values(prev)) {
        if (entry.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      }
      return {};
    });
  }, []);

  const value = useMemo(
    () => ({ registerImage, getImageUrl, clearImages }),
    [registerImage, getImageUrl, clearImages],
  );

  return (
    <SessionImagesContext.Provider value={value}>{children}</SessionImagesContext.Provider>
  );
}

export function useSessionImages() {
  const ctx = useContext(SessionImagesContext);
  if (!ctx) {
    throw new Error("useSessionImages must be used within SessionImagesProvider");
  }
  return ctx;
}

export function resolveSessionImageUrl(
  imageId: string,
  conversationId: string,
  localUrl?: string,
): string {
  if (localUrl) return localUrl;
  return `/api/analyze-image?imageId=${encodeURIComponent(imageId)}&conversationId=${encodeURIComponent(conversationId)}`;
}
