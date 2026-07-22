"use client";

import { useEffect, useRef, useState } from "react";
import { useConversation } from "@/lib/conversation/context";
import type { DemoScenario } from "@/lib/demo/scenarios";
import type { SetupPack } from "@/lib/setup/schemas";
import { saveSetupInputs } from "@/lib/setup/persist";
import { loadDemoWeldSample } from "@/lib/demo/sample-image";
import { Loader2 } from "lucide-react";

interface DemoOrchestratorProps {
  scenario: DemoScenario;
  mockVision: boolean;
  onStarted?: () => void;
  onError?: (message: string) => void;
}

async function fetchSetupPack(inputs: NonNullable<DemoScenario["setupInputs"]>): Promise<SetupPack> {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Setup pack failed");
  }
  const data = (await res.json()) as { pack: SetupPack };
  return data.pack;
}

export function DemoOrchestrator({
  scenario,
  mockVision,
  onStarted,
  onError,
}: DemoOrchestratorProps) {
  const { conversation, sendMessage, analyzeWeldPhoto, addArtifact, setCitations } =
    useConversation();
  const started = useRef(false);
  const [status, setStatus] = useState<string>("Preparing scenario…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      try {
        if (scenario.setupInputs) {
          saveSetupInputs(conversation.id, scenario.setupInputs);
        }

        if (scenario.action === "setup-pack-then-chat") {
          setStatus("Generating setup pack from manual…");
          const pack = await fetchSetupPack(scenario.setupInputs!);
          pack.artifacts.forEach((spec, i) => {
            addArtifact(`demo-setup-${conversation.id}-${i}`, spec);
          });
          if (pack.citations.length) setCitations(pack.citations);
          setStatus("Asking WeldPilot (real agent)…");
          await sendMessage(scenario.prompt);
        } else if (scenario.action === "settings-pack") {
          setStatus("");
          onStarted?.();
        } else if (scenario.action === "chat") {
          setStatus("Asking WeldPilot (real agent)…");
          await sendMessage(scenario.prompt);
        } else if (scenario.action === "visual-analysis") {
          setStatus("Loading bundled sample weld image…");
          const sample = await loadDemoWeldSample(scenario.sampleImagePath);
          setStatus(
            mockVision
              ? "Running vision analysis (mock mode — dev only)…"
              : "Running vision analysis (real Claude vision)…",
          );
          await analyzeWeldPhoto({
            imageBase64: sample.base64,
            mimeType: sample.mimeType,
            previewUrl: sample.previewUrl,
            context: scenario.visionContext,
            mock: mockVision,
          });
        }

        setStatus("");
        onStarted?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Demo scenario failed";
        setStatus("");
        onError?.(message);
      }
    };

    const timer = setTimeout(() => void run(), 400);
    return () => clearTimeout(timer);
  }, [
    scenario,
    mockVision,
    conversation.id,
    sendMessage,
    analyzeWeldPhoto,
    addArtifact,
    setCitations,
    onStarted,
    onError,
  ]);

  if (!status) return null;

  return (
    <div
      className="flex items-center gap-2 border-b border-garage-orange/30 bg-garage-orange/10 px-4 py-2 text-sm text-garage-text"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin text-garage-orange" aria-hidden />
      {status}
    </div>
  );
}
