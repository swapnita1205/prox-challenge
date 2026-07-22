import type { PlaceholderArtifactSchema } from "@/lib/schemas/artifacts/types";
import type { z } from "zod";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

type Spec = z.infer<typeof PlaceholderArtifactSchema>;

interface ArtifactPlaceholderProps {
  spec: Spec;
}

export function ArtifactPlaceholder({ spec }: ArtifactPlaceholderProps) {
  return (
    <EmptyState
      icon={<Layers className="h-6 w-6" aria-hidden />}
      title={spec.title}
      description={spec.description}
      className="h-full min-h-[12rem]"
    />
  );
}
