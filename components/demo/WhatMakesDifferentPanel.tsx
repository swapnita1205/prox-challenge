import { DEMO_DIFFERENTIATORS } from "@/lib/demo/scenarios";
import {
  Brain,
  Calculator,
  Database,
  ImageIcon,
  MessageCircleQuestion,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const ICONS = [
  Database,
  ImageIcon,
  Brain,
  MessageCircleQuestion,
  ShieldCheck,
  Calculator,
  Sparkles,
];

export function WhatMakesDifferentPanel() {
  return (
    <section
      className="rounded-xl border border-garage-border bg-garage-panel p-6"
      aria-labelledby="different-heading"
    >
      <h2 id="different-heading" className="mb-2 text-xl font-bold text-garage-text">
        What makes this different?
      </h2>
      <p className="mb-6 text-sm text-garage-muted">
        WeldPilot is not a RAG chatbot with a welder skin. Each capability below maps to
        challenge criteria you can verify in the scenarios.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2" role="list">
        {DEMO_DIFFERENTIATORS.map((item, i) => {
          const Icon = ICONS[i] ?? Sparkles;
          return (
            <li
              key={item.title}
              className="flex gap-3 rounded-lg border border-garage-border bg-garage-bg p-4"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-garage-orange" aria-hidden />
              <div>
                <h3 className="text-sm font-semibold text-garage-text">{item.title}</h3>
                <p className="mt-1 text-sm text-garage-muted">{item.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
