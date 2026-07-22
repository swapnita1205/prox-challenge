"use client";

import Link from "next/link";
import type { DemoScenario } from "@/lib/demo/scenarios";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Play } from "lucide-react";

interface DemoScenarioCardProps {
  scenario: DemoScenario;
  index: number;
}

export function DemoScenarioCard({ scenario, index }: DemoScenarioCardProps) {
  return (
    <article
      className={cn(
        "group flex flex-col rounded-xl border border-garage-border bg-garage-panel p-5 transition-colors",
        "hover:border-garage-orange/40 hover:bg-garage-panel/90",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-garage-orange/20 font-mono text-sm font-bold text-garage-orange">
            {index + 1}
          </span>
          <div>
            <h3 className="font-semibold text-garage-text">{scenario.title}</h3>
            <p className="text-sm text-garage-muted">{scenario.subtitle}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 gap-1 text-xs">
          <Clock className="h-3 w-3" aria-hidden />
          ~{scenario.durationMinutes} min
        </Badge>
      </div>

      <blockquote className="mb-3 rounded-md border-l-2 border-garage-orange/50 bg-garage-bg px-3 py-2 text-sm italic text-garage-text">
        &ldquo;{scenario.prompt}&rdquo;
      </blockquote>

      <ul className="mb-4 flex-1 space-y-1" role="list">
        {scenario.expectedHighlights.slice(0, 3).map((h) => (
          <li key={h} className="text-xs text-garage-muted before:mr-1.5 before:text-garage-orange before:content-['•']">
            {h}
          </li>
        ))}
      </ul>

      <div className="mb-4 flex flex-wrap gap-1">
        {scenario.criteriaTags.map((tag) => (
          <Badge key={tag} variant="default" className="text-[10px]">
            {tag}
          </Badge>
        ))}
      </div>

      <Link
        href={`/demo/${scenario.id}`}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-md bg-garage-orange px-4 py-2 text-sm font-medium text-white",
          "hover:bg-garage-orange-dim",
        )}
      >
        <Play className="h-4 w-4" aria-hidden />
        Run scenario
        <ArrowRight className="ml-auto h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}
