import Link from "next/link";
import { DEMO_SCENARIOS, TOTAL_DEMO_MINUTES } from "@/lib/demo/scenarios";
import { DemoScenarioCard } from "@/components/demo/DemoScenarioCard";
import { WhatMakesDifferentPanel } from "@/components/demo/WhatMakesDifferentPanel";
import { hasValidApiKey } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Flame, Play, AlertTriangle } from "lucide-react";

const primaryBtn =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-garage-orange px-6 text-base font-medium text-white hover:bg-garage-orange-dim";
const outlineBtn =
  "inline-flex h-12 items-center justify-center gap-2 rounded-md border border-garage-border bg-garage-panel px-6 text-base font-medium text-garage-text hover:bg-garage-bg";

export default function DemoHubPage() {
  const apiKeyOk = hasValidApiKey();

  return (
    <div className="min-h-screen bg-garage-bg">
      <header className="border-b border-garage-border bg-garage-panel">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm text-garage-muted hover:text-garage-text"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </Link>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-garage-orange" aria-hidden />
              <span className="font-mono text-lg font-bold">
                Weld<span className="text-garage-orange">Pilot</span>
              </span>
            </div>
            <Badge variant="outline">Judge Demo</Badge>
          </div>
          <Badge variant="default" className="gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            ~{Math.ceil(TOTAL_DEMO_MINUTES)} min total
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {!apiKeyOk && (
          <div
            className="mb-8 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">ANTHROPIC_API_KEY required for live agent demos</p>
              <p className="mt-1 text-amber-200/80">
                Chat scenarios call the real Claude Agent SDK when your key is configured.
                Without it, placeholder responses are shown and clearly labeled — they are not
                presented as live AI output.
              </p>
            </div>
          </div>
        )}

        <section className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Guided demo for judges
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-lg text-garage-muted">
            Five one-click scenarios covering technical accuracy, multimodal artifacts,
            structured diagnosis, settings configuration, and visual weld analysis — each
            using the real WeldPilot agent pipeline.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/demo/duty-cycle" className={primaryBtn}>
              <Play className="h-4 w-4" />
              Start with Duty Cycle
            </Link>
            <Link href="/workspace?mode=manual" className={outlineBtn}>
              Open full workspace
            </Link>
          </div>
        </section>

        <section className="mb-12" aria-labelledby="scenarios-heading">
          <h2
            id="scenarios-heading"
            className="mb-6 font-mono text-sm font-semibold uppercase tracking-widest text-garage-muted"
          >
            One-click scenarios
          </h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {DEMO_SCENARIOS.map((scenario, index) => (
              <DemoScenarioCard key={scenario.id} scenario={scenario} index={index} />
            ))}
          </div>
        </section>

        <WhatMakesDifferentPanel />

        <footer className="mt-12 border-t border-garage-border pt-8 text-center text-sm text-garage-muted">
          <p>
            Machine-specific facts from Harbor Freight owner&apos;s manual · Vulcan OmniPro 220
          </p>
        </footer>
      </main>
    </div>
  );
}
