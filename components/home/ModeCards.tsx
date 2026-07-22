"use client";

import Link from "next/link";
import { WELD_MODES, type WeldMode } from "@/lib/schemas/conversation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Search, SlidersHorizontal, Wrench, ArrowRight } from "lucide-react";

const ICONS = {
  wrench: Wrench,
  search: Search,
  sliders: SlidersHorizontal,
  book: BookOpen,
} as const;

const MODE_NUMBERS: Record<WeldMode, string> = {
  setup: "01",
  diagnose: "02",
  settings: "03",
  manual: "04",
};

interface ModeCardProps {
  mode: WeldMode;
}

export function ModeCard({ mode }: ModeCardProps) {
  const config = WELD_MODES[mode];
  const Icon = ICONS[config.icon as keyof typeof ICONS] ?? Wrench;

  return (
    <Link
      href={`/workspace?mode=${mode}`}
      className="mode-card-accent group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garage-orange focus-visible:ring-offset-2 focus-visible:ring-offset-garage-bg"
    >
      <Card className="h-full border-garage-border bg-garage-panel transition-all duration-200 group-hover:border-garage-border-bright group-hover:shadow-panel-raised group-focus-within:border-garage-orange/40">
        <CardHeader className="pb-3">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-garage-orange/25 bg-garage-orange/10 transition-colors group-hover:border-garage-orange/40">
              <Icon className="h-4 w-4 text-garage-orange" aria-hidden />
            </div>
            <span className="font-mono text-2xs text-garage-muted">{MODE_NUMBERS[mode]}</span>
          </div>
          <CardTitle className="text-base transition-colors group-hover:text-garage-orange sm:text-lg">
            {config.title}
          </CardTitle>
          <CardDescription className="leading-relaxed">{config.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wider text-garage-orange">
            Open workspace
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function ModeCards() {
  const modes = Object.keys(WELD_MODES) as WeldMode[];

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {modes.map((mode) => (
        <ModeCard key={mode} mode={mode} />
      ))}
    </div>
  );
}
