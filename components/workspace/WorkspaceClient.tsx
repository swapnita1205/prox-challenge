"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConversationProvider } from "@/lib/conversation/context";
import { SessionImagesProvider } from "@/lib/vision/session-images-client";
import { GarageModeProvider } from "@/lib/garage/GarageModeProvider";
import { MicroInteractionProvider } from "@/lib/ui/micro-interactions";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { WeldModeSchema, type WeldMode } from "@/lib/schemas/conversation";

export function WorkspaceClient({
  apiKeyConfigured,
}: {
  apiKeyConfigured: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const modeParam = searchParams.get("mode");
  const parsed = WeldModeSchema.safeParse(modeParam);
  const mode: WeldMode = parsed.success ? parsed.data : "manual";

  useEffect(() => {
    if (!parsed.success && modeParam) {
      router.replace("/workspace?mode=manual");
    }
  }, [parsed.success, modeParam, router]);

  return (
    <ConversationProvider mode={mode} key={mode}>
      <SessionImagesProvider>
        <GarageModeProvider>
          <MicroInteractionProvider>
            <WorkspaceLayout apiKeyConfigured={apiKeyConfigured} />
          </MicroInteractionProvider>
        </GarageModeProvider>
      </SessionImagesProvider>
    </ConversationProvider>
  );
}
