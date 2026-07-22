import type { SetupInputs } from "@/lib/setup/schemas";
import { SetupInputsSchema } from "@/lib/setup/schemas";

const STORAGE_PREFIX = "weldpilot-setup-";

export function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

export function saveSetupInputs(conversationId: string, inputs: SetupInputs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(conversationId), JSON.stringify(inputs));
  } catch {
    // ignore
  }
}

export function loadSetupInputs(conversationId: string): SetupInputs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(conversationId));
    if (!raw) return {};
    return SetupInputsSchema.parse(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function clearSetupInputs(conversationId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(conversationId));
  } catch {
    // ignore
  }
}
