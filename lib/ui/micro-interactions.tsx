"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MicroInteractionType =
  | "evidence"
  | "hypothesis_eliminated"
  | "confidence_change"
  | "artifact"
  | "config_conflict";

interface MicroInteractionContextValue {
  /** Monotonic counter bumped on each flash; pair with type for CSS triggers */
  flash: (type: MicroInteractionType) => void;
  activeType: MicroInteractionType | null;
  flashId: number;
}

const MicroInteractionContext = createContext<MicroInteractionContextValue | null>(
  null,
);

export function MicroInteractionProvider({ children }: { children: ReactNode }) {
  const [activeType, setActiveType] = useState<MicroInteractionType | null>(null);
  const [flashId, setFlashId] = useState(0);

  const flash = useCallback((type: MicroInteractionType) => {
    setActiveType(type);
    setFlashId((n) => n + 1);
    window.setTimeout(() => setActiveType(null), 700);
  }, []);

  const value = useMemo(
    () => ({ flash, activeType, flashId }),
    [flash, activeType, flashId],
  );

  return (
    <MicroInteractionContext.Provider value={value}>
      {children}
    </MicroInteractionContext.Provider>
  );
}

export function useMicroInteractions() {
  const ctx = useContext(MicroInteractionContext);
  if (!ctx) {
    throw new Error("useMicroInteractions must be used within MicroInteractionProvider");
  }
  return ctx;
}

/** Returns class names when the given interaction type is actively flashing */
export function useMicroFlash(type: MicroInteractionType): string {
  const { activeType } = useMicroInteractions();
  return activeType === type ? "micro-flash-active" : "";
}
