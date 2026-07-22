"use client";

import { useCallback, useEffect, useState } from "react";
import { useConversation } from "@/lib/conversation/context";
import type { SetupInputs, SetupPack } from "@/lib/setup/schemas";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

async function fetchSetupPack(inputs: SetupInputs): Promise<SetupPack> {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) throw new Error("Failed to load settings pack");
  const data = (await res.json()) as { pack: SetupPack };
  return data.pack;
}

interface DemoSettingsPanelProps {
  inputs: SetupInputs;
  scenarioPrompt: string;
}

export function DemoSettingsPanel({ inputs, scenarioPrompt }: DemoSettingsPanelProps) {
  const { conversation, addArtifact, setCitations, sendMessage } = useConversation();
  const [pack, setPack] = useState<SetupPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);

  const applyPack = useCallback(
    (newPack: SetupPack) => {
      setPack(newPack);
      newPack.artifacts.forEach((spec, i) => {
        addArtifact(`demo-settings-${conversation.id}-${i}`, spec);
      });
      if (newPack.citations.length) setCitations(newPack.citations);
    },
    [addArtifact, setCitations, conversation.id],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchSetupPack(inputs)
      .then((p) => {
        if (!cancelled) applyPack(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inputs, applyPack]);

  useEffect(() => {
    if (!pack || sent || loading) return;
    setSent(true);
    void sendMessage(scenarioPrompt);
  }, [pack, sent, loading, sendMessage, scenarioPrompt]);

  return (
    <section className="border-b border-garage-border bg-garage-panel/80 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-garage-orange" aria-hidden />
        <h2 className="text-sm font-semibold text-garage-text">Settings Configurator</h2>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-garage-muted" />}
        {pack && (
          <Badge
            variant={pack.validation.valid ? "default" : "outline"}
            className={cn(
              "text-xs",
              !pack.validation.valid && "border-amber-500/50 text-amber-200",
            )}
          >
            {pack.validation.status}
          </Badge>
        )}
      </div>

      {pack && (
        <div className="space-y-2">
          <p className="text-xs text-garage-muted">
            {pack.processLabel} · {inputs.material} · {inputs.thickness} · {inputs.inputVoltage}V
          </p>
          {pack.validation.issues.length > 0 && (
            <ul className="space-y-1" role="list">
              {pack.validation.issues.map((issue) => (
                <li
                  key={issue.code}
                  className="flex items-start gap-2 text-xs text-amber-200"
                >
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
