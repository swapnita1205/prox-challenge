"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ConversationProvider } from "@/lib/conversation/context";
import { SessionImagesProvider, useSessionImages } from "@/lib/vision/session-images-client";
import { GarageModeProvider } from "@/lib/garage/GarageModeProvider";
import { MicroInteractionProvider } from "@/lib/ui/micro-interactions";
import { MicroInteractionWatcher } from "@/components/workspace/MicroInteractionWatcher";
import { DemoRunnerLayout } from "@/components/demo/DemoRunnerLayout";
import type { DemoScenario } from "@/lib/demo/scenarios";
import { canShowDemoMockToggle } from "@/lib/demo/mock";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DemoRunnerClientProps {
  scenario: DemoScenario;
  apiKeyConfigured: boolean;
}

function DemoSessionShell({
  scenario,
  apiKeyConfigured,
  mockVision,
  onMockVisionChange,
  showMockToggle,
  onResetDemo,
}: {
  scenario: DemoScenario;
  apiKeyConfigured: boolean;
  mockVision: boolean;
  onMockVisionChange: (v: boolean) => void;
  showMockToggle: boolean;
  onResetDemo: () => void;
}) {
  const { clearImages } = useSessionImages();

  const handleReset = useCallback(() => {
    clearImages();
    onResetDemo();
  }, [clearImages, onResetDemo]);

  return (
    <DemoRunnerLayout
      scenario={scenario}
      apiKeyConfigured={apiKeyConfigured}
      mockVision={mockVision}
      onMockVisionChange={onMockVisionChange}
      showMockToggle={showMockToggle}
      onResetDemo={handleReset}
    />
  );
}

export function DemoRunnerClient({ scenario, apiKeyConfigured }: DemoRunnerClientProps) {
  const [mockVision, setMockVision] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);
  const showMockToggle = canShowDemoMockToggle();

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-garage-border bg-garage-panel px-4 py-2">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-garage-muted hover:text-garage-text">
            <Flame className="h-4 w-4 text-garage-orange" />
            WeldPilot Demo
          </Link>
          <Badge variant="outline" className="text-xs">
            Real agent · {scenario.mode} mode
          </Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ConversationProvider
          mode={scenario.mode}
          key={`${scenario.id}-${scenario.mode}-${resetNonce}`}
          initialSetupInputs={scenario.setupInputs}
        >
          <SessionImagesProvider>
            <GarageModeProvider>
              <MicroInteractionProvider>
                <MicroInteractionWatcher />
                <DemoSessionShell
                  scenario={scenario}
                  apiKeyConfigured={apiKeyConfigured}
                  mockVision={mockVision}
                  onMockVisionChange={setMockVision}
                  showMockToggle={showMockToggle}
                  onResetDemo={() => setResetNonce((n) => n + 1)}
                />
              </MicroInteractionProvider>
            </GarageModeProvider>
          </SessionImagesProvider>
        </ConversationProvider>
      </div>
    </div>
  );
}
