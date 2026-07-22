import Link from "next/link";
import { ArtifactGalleryClient } from "@/components/artifacts/ArtifactGalleryClient";

export const metadata = {
  title: "Artifact Gallery — WeldPilot Dev",
  description: "Developer gallery of typed WeldPilot artifacts",
};

export default function ArtifactGalleryPage() {
  return (
    <main className="min-h-screen bg-garage-bg">
      <header className="border-b border-garage-border px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-garage-orange">
              Developer
            </p>
            <h1 className="text-2xl font-semibold text-garage-text">Artifact Gallery</h1>
            <p className="mt-1 text-sm text-garage-muted">
              Typed ArtifactSpec renderers — no arbitrary HTML/JS from the model.
            </p>
          </div>
          <Link
            href="/"
            className="rounded border border-garage-border px-4 py-2 font-mono text-xs uppercase text-garage-muted hover:border-garage-orange hover:text-garage-orange"
          >
            ← Home
          </Link>
        </div>
      </header>
      <ArtifactGalleryClient />
    </main>
  );
}
