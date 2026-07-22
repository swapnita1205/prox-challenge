"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@/lib/conversation/context";
import type { SetupInputs, SetupPack, WizardStep } from "@/lib/setup/schemas";
import {
  canGeneratePack,
  getVisibleSteps,
  isStepComplete,
  stepLabel,
} from "@/lib/setup/steps";
import { loadSetupInputs, saveSetupInputs } from "@/lib/setup/persist";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  RotateCcw,
  Wrench,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

const MATERIALS = ["Mild Steel", "Stainless Steel", "Aluminum", "Chrome Moly"];
const THICKNESSES = ['1/16"', '1/8"', '3/16"', '1/4"', '3/8"', '1/2"'];
const WIRE_DIAMETERS = ['0.023"', '0.030"', '0.035"', '0.045"'];

async function fetchSetupPack(inputs: SetupInputs): Promise<SetupPack> {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to generate setup pack");
  }
  const data = (await res.json()) as { pack: SetupPack };
  return data.pack;
}

export function SetupWizard() {
  const { conversation, addArtifact, setCitations, sendMessage } = useConversation();
  const [inputs, setInputs] = useState<SetupInputs>(() => loadSetupInputs(conversation.id));
  const [step, setStep] = useState<WizardStep>("process");
  const [pack, setPack] = useState<SetupPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasGenerated = useRef(false);
  const regenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleSteps = useMemo(() => getVisibleSteps(inputs), [inputs]);

  useEffect(() => {
    saveSetupInputs(conversation.id, inputs);
  }, [conversation.id, inputs]);

  const updateInput = useCallback(
    <K extends keyof SetupInputs>(key: K, value: SetupInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applyPack = useCallback(
    (newPack: SetupPack) => {
      setPack(newPack);
      newPack.artifacts.forEach((spec) => {
        addArtifact(`setup-${conversation.id}-${spec.type}`, spec);
      });
      if (newPack.citations.length) setCitations(newPack.citations);
    },
    [addArtifact, setCitations, conversation.id],
  );

  const generate = useCallback(async () => {
    if (!canGeneratePack(inputs)) return;
    setLoading(true);
    setError(null);
    try {
      const newPack = await fetchSetupPack(inputs);
      applyPack(newPack);
      hasGenerated.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [inputs, applyPack]);

  useEffect(() => {
    if (!hasGenerated.current || !canGeneratePack(inputs)) return;
    if (regenTimer.current) clearTimeout(regenTimer.current);
    regenTimer.current = setTimeout(() => {
      void generate();
    }, 600);
    return () => {
      if (regenTimer.current) clearTimeout(regenTimer.current);
    };
  }, [inputs, generate]);

  const reset = () => {
    setInputs({});
    setPack(null);
    setStep("process");
    hasGenerated.current = false;
    saveSetupInputs(conversation.id, {});
  };

  const goNext = () => {
    const idx = visibleSteps.indexOf(step);
    if (idx < visibleSteps.length - 1) {
      setStep(visibleSteps[idx + 1]!);
    }
  };

  const goBack = () => {
    const idx = visibleSteps.indexOf(step);
    if (idx > 0) setStep(visibleSteps[idx - 1]!);
  };

  const askWeldPilot = () => {
    const prompt = pack?.askPrompt ?? "Help me set up my OmniPro 220.";
    void sendMessage(prompt);
  };

  if (conversation.mode !== "setup") return null;

  return (
    <section
      className="shrink-0 border-b border-garage-border bg-garage-panel/90 px-3 py-3 sm:px-4"
      aria-label="Setup My Welder wizard"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-garage-orange" aria-hidden />
          <h2 className="text-sm font-semibold text-garage-text">Setup My Welder</h2>
          {pack && (
            <Badge variant="outline" className="text-xs">
              {pack.validation.status}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw className="mr-1 h-3 w-3" />
          Start over
        </Button>
      </div>

      <nav className="mb-3 flex flex-wrap gap-1" aria-label="Setup wizard steps">
        {visibleSteps.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            aria-current={s === step ? "step" : undefined}
            className={`rounded-md border px-2.5 py-1 font-mono text-2xs uppercase tracking-wider transition-colors duration-200 ${
              s === step
                ? "border-garage-orange bg-garage-orange text-white"
                : isStepComplete(s, inputs)
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-transparent bg-garage-bg text-garage-muted hover:border-garage-border hover:text-garage-text"
            }`}
          >
            {stepLabel(s)}
          </button>
        ))}
      </nav>

      <div className="mb-3 rounded-md border border-garage-border bg-garage-bg p-3 shadow-panel">
        <p className="label-caps mb-2">{stepLabel(step)}</p>

        {step === "process" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["mig-solid", "MIG Solid Core (gas)"],
                ["flux", "Flux-Cored"],
                ["tig", "TIG"],
                ["stick", "Stick"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => updateInput("process", id)}
                className={`rounded-md border p-3 text-left text-sm transition-colors duration-200 ${
                  inputs.process === id
                    ? "border-garage-orange bg-garage-orange/5 ring-1 ring-garage-orange/30"
                    : "border-garage-border hover:border-garage-border-bright"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {step === "voltage" && (
          <div className="flex gap-2">
            {([120, 240] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => updateInput("inputVoltage", v)}
                className={`flex-1 rounded-lg border py-2 text-sm ${
                  inputs.inputVoltage === v
                    ? "border-garage-orange bg-garage-orange/10"
                    : "border-garage-border"
                }`}
              >
                {v} V
              </button>
            ))}
          </div>
        )}

        {step === "material" && (
          <div className="flex flex-wrap gap-2">
            {MATERIALS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateInput("material", m)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  inputs.material === m ? "border-garage-orange" : "border-garage-border"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {step === "thickness" && (
          <div className="flex flex-wrap gap-2">
            {THICKNESSES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateInput("thickness", t)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  inputs.thickness === t ? "border-garage-orange" : "border-garage-border"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {step === "consumable" && (
          <input
            type="text"
            value={inputs.consumable ?? ""}
            onChange={(e) => updateInput("consumable", e.target.value)}
            placeholder={
              inputs.process === "stick"
                ? "e.g. E7018 electrode"
                : inputs.process === "tig"
                  ? "e.g. ER70S-2 filler rod"
                  : "e.g. ER70S-6 solid wire or E71T-11 flux wire"
            }
            className="w-full rounded-md border border-garage-border bg-garage-panel px-3 py-2 text-sm"
          />
        )}

        {step === "wire" && (
          <div className="flex flex-wrap gap-2">
            {WIRE_DIAMETERS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => updateInput("wireDiameter", d)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  inputs.wireDiameter === d ? "border-garage-orange" : "border-garage-border"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {step === "shielding" && inputs.process === "mig-solid" && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => updateInput("shielding", "c25")}
              className={`block w-full rounded-lg border p-2 text-left text-sm ${
                inputs.shielding === "c25" ? "border-garage-orange" : "border-garage-border"
              }`}
            >
              C25 (75% Ar / 25% CO₂) — per manual p.14
            </button>
          </div>
        )}

        {step === "shielding" && inputs.process === "flux" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                updateInput("gasShieldedFlux", false);
                updateInput("shielding", "none");
              }}
              className={`flex-1 rounded-lg border p-2 text-sm ${
                inputs.gasShieldedFlux === false ? "border-garage-orange" : "border-garage-border"
              }`}
            >
              Self-shielded (gasless)
            </button>
            <button
              type="button"
              onClick={() => {
                updateInput("gasShieldedFlux", true);
                updateInput("shielding", "dual-shield");
              }}
              className={`flex-1 rounded-lg border p-2 text-sm ${
                inputs.gasShieldedFlux === true ? "border-garage-orange" : "border-garage-border"
              }`}
            >
              Gas-shielded flux
            </button>
          </div>
        )}

        {step === "shielding" && inputs.process === "tig" && (
          <button
            type="button"
            onClick={() => updateInput("shielding", "100-argon")}
            className={`w-full rounded-lg border p-2 text-left text-sm ${
              inputs.shielding === "100-argon" ? "border-garage-orange" : "border-garage-border"
            }`}
          >
            100% Argon — per manual p.24
          </button>
        )}

        {step === "optional" && (
          <div className="space-y-2">
            {(inputs.process === "mig-solid" || inputs.process === "flux") && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inputs.spoolGun ?? false}
                  onChange={(e) => updateInput("spoolGun", e.target.checked)}
                />
                Using optional spool gun (p.17)
              </label>
            )}
            <textarea
              value={inputs.optionalNotes ?? ""}
              onChange={(e) => updateInput("optionalNotes", e.target.value)}
              placeholder="Any other setup details…"
              rows={2}
              className="w-full rounded-md border border-garage-border bg-garage-panel px-3 py-2 text-sm"
            />
          </div>
        )}

        {step === "review" && (
          <dl className="grid gap-1 text-sm">
            {inputs.process && (
              <>
                <dt className="text-garage-muted">Process</dt>
                <dd className="text-garage-text">{inputs.process}</dd>
              </>
            )}
            {inputs.inputVoltage && (
              <>
                <dt className="text-garage-muted">Voltage</dt>
                <dd>{inputs.inputVoltage} V</dd>
              </>
            )}
            {inputs.material && (
              <>
                <dt className="text-garage-muted">Material</dt>
                <dd>{inputs.material}</dd>
              </>
            )}
            {inputs.thickness && (
              <>
                <dt className="text-garage-muted">Thickness</dt>
                <dd>{inputs.thickness}</dd>
              </>
            )}
            {inputs.consumable && (
              <>
                <dt className="text-garage-muted">Consumable</dt>
                <dd>{inputs.consumable}</dd>
              </>
            )}
            {inputs.wireDiameter && (
              <>
                <dt className="text-garage-muted">Wire</dt>
                <dd>{inputs.wireDiameter}</dd>
              </>
            )}
          </dl>
        )}
      </div>

      {error && (
        <p className="mb-2 text-xs text-red-300" role="alert">
          {error}
        </p>
      )}

      {pack && pack.validation.issues.length > 0 && (
        <ul className="mb-2 space-y-1" role="list">
          {pack.validation.issues.map((issue, i) => (
            <li
              key={i}
              className={`flex items-start gap-1 text-xs ${
                issue.severity === "error"
                  ? "text-red-300"
                  : issue.severity === "warning"
                    ? "text-amber-200"
                    : "text-garage-muted"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={goBack} disabled={visibleSteps.indexOf(step) === 0}>
          <ChevronLeft className="h-3 w-3" />
          Back
        </Button>
        {step !== "review" ? (
          <Button
            size="sm"
            onClick={goNext}
            disabled={!isStepComplete(step, inputs)}
          >
            Next
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        ) : (
          <Button size="sm" onClick={() => void generate()} disabled={loading || !canGeneratePack(inputs)}>
            {loading ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Generating…
              </>
            ) : pack ? (
              <>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Regenerate Setup Pack
              </>
            ) : (
              "Generate Setup Pack"
            )}
          </Button>
        )}
        {pack && (
          <Button variant="outline" size="sm" onClick={askWeldPilot}>
            <MessageCircle className="mr-1 h-3 w-3" />
            Ask WeldPilot about this setup
          </Button>
        )}
      </div>

      {pack && hasGenerated.current && (
        <p className="mt-2 text-xs text-garage-muted">
          Editing any input will automatically regenerate artifacts. Settings values come from the door chart — not interpolated.
        </p>
      )}
    </section>
  );
}
