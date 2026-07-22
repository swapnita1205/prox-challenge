"use client";

import { useCallback, useEffect, useState } from "react";
import type { DetectiveSnapshot, DiagnosticSession } from "@/lib/detective/schemas";
import type { ArtifactSpec } from "@/lib/schemas/artifacts";
import {
  clearClientSession,
  loadClientSession,
  saveClientSession,
} from "@/lib/detective/persist";
import { buildSnapshot } from "@/lib/detective/engine";
import { sessionToHypothesisArtifact } from "@/lib/detective/artifact";

interface DetectiveResponse {
  session: DiagnosticSession;
  snapshot: DetectiveSnapshot;
  artifact: ArtifactSpec;
  explanation?: string;
}

async function callDetective(body: Record<string, unknown>): Promise<DetectiveResponse> {
  const res = await fetch("/api/detective", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Detective API failed (${res.status})`);
  }
  return res.json() as Promise<DetectiveResponse>;
}

export function useMachineDetective(conversationId: string) {
  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [snapshot, setSnapshot] = useState<DetectiveSnapshot | null>(null);
  const [artifact, setArtifact] = useState<ArtifactSpec | null>(null);
  const [whyExplanation, setWhyExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = loadClientSession(conversationId);
    if (cached) {
      setSession(cached);
      setSnapshot(buildSnapshot(cached));
      setArtifact(sessionToHypothesisArtifact(cached));
    } else {
      setSession(null);
      setSnapshot(null);
      setArtifact(null);
    }
  }, [conversationId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DiagnosticSession>).detail;
      if (!detail) return;
      setSession(detail);
      setSnapshot(buildSnapshot(detail));
      setArtifact(sessionToHypothesisArtifact(detail));
      saveClientSession(conversationId, detail);
    };
    const onCleared = () => {
      setSession(null);
      setSnapshot(null);
      setArtifact(null);
      setWhyExplanation(null);
      setError(null);
    };
    window.addEventListener("weldpilot-detective-updated", handler);
    window.addEventListener("weldpilot-detective-cleared", onCleared);
    return () => {
      window.removeEventListener("weldpilot-detective-updated", handler);
      window.removeEventListener("weldpilot-detective-cleared", onCleared);
    };
  }, [conversationId]);

  const persist = useCallback(
    (data: DetectiveResponse) => {
      setSession(data.session);
      setSnapshot(data.snapshot);
      setArtifact(data.artifact);
      saveClientSession(conversationId, data.session);
    },
    [conversationId],
  );

  const start = useCallback(
    async (complaint: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await callDetective({
          action: "start",
          complaint,
          sessionId: conversationId,
        });
        persist(data);
        setWhyExplanation(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to start diagnostic";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [conversationId, persist],
  );

  const answer = useCallback(
    async (questionId: string, answerText: string) => {
      if (!session) return;
      setLoading(true);
      setError(null);
      try {
        const data = await callDetective({
          action: "answer",
          sessionId: session.id,
          questionId,
          answer: answerText,
        });
        persist(data);
        setWhyExplanation(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to record answer";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [session, persist],
  );

  const alreadyChecked = useCallback(
    async (questionId: string, result: string) => {
      if (!session) return;
      setLoading(true);
      setError(null);
      try {
        const data = await callDetective({
          action: "already_checked",
          sessionId: session.id,
          questionId,
          result,
        });
        persist(data);
        setWhyExplanation(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to mark checked";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [session, persist],
  );

  const startOverSession = useCallback(
    async (complaint?: string) => {
      setLoading(true);
      setError(null);
      try {
        clearClientSession(conversationId);
        const data = await callDetective({
          action: "start_over",
          sessionId: session?.id,
          complaint,
        });
        persist(data);
        setWhyExplanation(null);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to restart";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [conversationId, session?.id, persist],
  );

  const explainWhy = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await callDetective({ action: "why", sessionId: session.id });
      setWhyExplanation(data.explanation ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load explanation");
    } finally {
      setLoading(false);
    }
  }, [session]);

  return {
    session,
    snapshot,
    artifact,
    whyExplanation,
    loading,
    error,
    start,
    answer,
    alreadyChecked,
    startOver: startOverSession,
    explainWhy,
  };
}
