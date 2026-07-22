"use client";

import { useEffect, useRef } from "react";
import { useConversation } from "@/lib/conversation/context";
import { useMachineDetective } from "@/lib/detective/useMachineDetective";
import { useMicroInteractions } from "@/lib/ui/micro-interactions";

/**
 * Observes conversation / detective state and triggers visual micro-interactions.
 * Does not alter factual behavior — only dispatches flash events.
 */
export function MicroInteractionWatcher() {
  const { citations, grounding, conversation, activeArtifact } = useConversation();
  const { session, snapshot } = useMachineDetective(conversation.id);
  const { flash } = useMicroInteractions();

  const ready = useRef(false);
  const prevCitations = useRef(0);
  const prevEliminated = useRef(0);
  const prevConfidence = useRef<number | null>(null);
  const prevArtifactId = useRef<string | null>(null);
  const prevGroundingStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!ready.current) {
      ready.current = true;
      prevCitations.current = citations.length;
      prevEliminated.current =
        snapshot?.eliminatedFaults.length ?? session?.eliminatedFaultIds.length ?? 0;
      prevConfidence.current =
        session?.diagnosticConfidence ??
        (grounding ? grounding.coverage.coverageScore : null);
      prevArtifactId.current = activeArtifact?.id ?? conversation.activeArtifactId ?? null;
      prevGroundingStatus.current = grounding?.status ?? null;
      return;
    }

    if (citations.length > prevCitations.current) {
      flash("evidence");
    }
    prevCitations.current = citations.length;

    const eliminated =
      snapshot?.eliminatedFaults.length ?? session?.eliminatedFaultIds.length ?? 0;
    if (eliminated > prevEliminated.current) {
      flash("hypothesis_eliminated");
    }
    prevEliminated.current = eliminated;

    const confidence =
      session?.diagnosticConfidence ??
      (grounding ? grounding.coverage.coverageScore : null);
    if (
      prevConfidence.current !== null &&
      confidence !== null &&
      Math.abs(confidence - prevConfidence.current) > 0.02
    ) {
      flash("confidence_change");
    }
    if (confidence !== null) prevConfidence.current = confidence;

    const id = activeArtifact?.id ?? conversation.activeArtifactId ?? null;
    if (id && id !== prevArtifactId.current) {
      flash("artifact");
    }
    prevArtifactId.current = id;

    if (
      grounding?.status === "conflicting_sources" &&
      prevGroundingStatus.current !== "conflicting_sources"
    ) {
      flash("config_conflict");
    }
    prevGroundingStatus.current = grounding?.status ?? null;
  }, [
    citations.length,
    snapshot?.eliminatedFaults.length,
    session?.eliminatedFaultIds.length,
    session?.diagnosticConfidence,
    grounding,
    activeArtifact?.id,
    conversation.activeArtifactId,
    flash,
  ]);

  return null;
}
