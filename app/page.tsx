import Link from "next/link";
import Image from "next/image";
import { ModeCards } from "@/components/home/ModeCards";
import { Badge } from "@/components/ui/badge";
import { hasValidApiKey } from "@/lib/env";
import { verifyKnowledgeBundle } from "@/lib/knowledge/bundle";
import { cn } from "@/lib/utils";
import { Flame, AlertTriangle, KeyRound, PlayCircle, BookOpen } from "lucide-react";

const linkButtonClass =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md px-3 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garage-orange focus-visible:ring-offset-2 focus-visible:ring-offset-garage-bg";

export default function HomePage() {
  const apiKeyOk = hasValidApiKey();
  const knowledge = verifyKnowledgeBundle();

  return (
    <div className="min-h-screen">
      <header className="border-b border-garage-border bg-garage-panel shadow-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-garage-orange sm:h-6 sm:w-6" aria-hidden />
            <span className="font-mono text-base font-bold tracking-tight sm:text-lg">
              Weld<span className="text-garage-orange">Pilot</span>
            </span>
          </div>
          <Badge variant="outline" className="font-mono text-2xs sm:text-xs">
            Vulcan OmniPro 220
          </Badge>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <section className="mb-8 rounded-md border border-garage-border bg-garage-panel p-4 shadow-panel sm:p-5">
          <p className="label-caps mb-2">Judge quick start</p>
          <p className="mb-4 text-sm leading-relaxed text-garage-muted">
            Bundled manual knowledge is pre-loaded — no database or ingestion step. Add your API
            key, pick a mode, or run the 5-minute guided demo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/demo"
              className={cn(
                linkButtonClass,
                "bg-garage-orange text-white hover:bg-garage-orange-dim",
              )}
            >
              <PlayCircle className="h-4 w-4" aria-hidden />
              5-min judge demo
            </Link>
            <Link
              href="/workspace?mode=manual"
              className={cn(
                linkButtonClass,
                "border border-garage-border bg-garage-panel text-garage-text hover:bg-garage-bg",
              )}
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Ask the manual
            </Link>
          </div>
          {knowledge.ok && knowledge.pageCount != null && (
            <p className="mt-3 font-mono text-2xs text-garage-muted">
              {knowledge.pageCount} manual pages bundled · knowledge OK
            </p>
          )}
        </section>

        {!apiKeyOk && (
          <div
            className="mb-8 flex items-start gap-3 rounded-md border border-amber-500/35 bg-amber-500/8 p-4"
            role="status"
          >
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-100">
                ANTHROPIC_API_KEY not configured
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-200/75">
                Copy{" "}
                <code className="rounded border border-amber-500/20 bg-black/20 px-1.5 py-0.5 font-mono text-xs">
                  .env.example
                </code>{" "}
                to{" "}
                <code className="rounded border border-amber-500/20 bg-black/20 px-1.5 py-0.5 font-mono text-xs">
                  .env
                </code>{" "}
                and add your key. The app runs with placeholder responses until the agent is
                connected.
              </p>
            </div>
          </div>
        )}

        <section className="mb-12 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          <div className="space-y-4">
            <p className="label-caps">OmniPro 220 copilot</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Setup, diagnose, and query the manual —{" "}
              <span className="text-garage-orange">with evidence</span>
            </h1>
            <p className="text-base leading-relaxed text-garage-muted sm:text-lg">
              Interactive diagrams, machine-specific citations, and session memory for your
              garage workflow.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <Image
              src="/product.webp"
              alt="Vulcan OmniPro 220 welder exterior"
              width={200}
              height={160}
              className="rounded-md border border-garage-border object-contain shadow-panel sm:w-[220px]"
              priority
            />
            <Image
              src="/product-inside.webp"
              alt="Vulcan OmniPro 220 interior wire feed compartment"
              width={200}
              height={160}
              className="hidden rounded-md border border-garage-border object-contain shadow-panel sm:block sm:w-[220px]"
            />
          </div>
        </section>

        <section aria-labelledby="modes-heading">
          <h2 id="modes-heading" className="label-caps mb-5">
            Choose a mode
          </h2>
          <ModeCards />
        </section>

        <footer className="mt-16 border-t border-garage-border pt-8 text-center text-sm text-garage-muted">
          <p className="flex items-center justify-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-garage-muted" aria-hidden />
            Machine facts sourced from Harbor Freight owner&apos;s manual. Not affiliated with
            Harbor Freight or Vulcan.
          </p>
          <p className="mt-3 font-mono text-2xs">
            <Link
              href="/demo"
              className="text-garage-orange transition-colors hover:text-garage-orange-dim"
            >
              Judge demo (5 min)
            </Link>
            <span className="mx-2 text-garage-border">|</span>
            <Link
              href="/workspace?mode=manual"
              className="text-garage-orange transition-colors hover:text-garage-orange-dim"
            >
              Jump to workspace
            </Link>
            <span className="mx-2 text-garage-border">|</span>
            <Link
              href="/dev/health"
              className="text-garage-muted transition-colors hover:text-garage-text"
            >
              System status
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
