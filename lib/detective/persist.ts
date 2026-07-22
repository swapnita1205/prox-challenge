import type { DiagnosticSession } from "@/lib/detective/schemas";
import { DiagnosticSessionSchema } from "@/lib/detective/schemas";

const STORAGE_PREFIX = "weldpilot-detective-";

const serverSessions = new Map<string, DiagnosticSession>();

export function saveServerSession(session: DiagnosticSession): void {
  serverSessions.set(session.id, session);
}

export function loadServerSession(sessionId: string): DiagnosticSession | null {
  return serverSessions.get(sessionId) ?? null;
}

export function deleteServerSession(sessionId: string): void {
  serverSessions.delete(sessionId);
}

export function resetServerSessions(): void {
  serverSessions.clear();
}

export function storageKey(conversationId: string): string {
  return `${STORAGE_PREFIX}${conversationId}`;
}

export function saveClientSession(conversationId: string, session: DiagnosticSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(conversationId), JSON.stringify(session));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadClientSession(conversationId: string): DiagnosticSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(conversationId));
    if (!raw) return null;
    return DiagnosticSessionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearClientSession(conversationId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(conversationId));
  } catch {
    // ignore
  }
}
