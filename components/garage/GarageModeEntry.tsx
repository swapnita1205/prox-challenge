"use client";

import { useGarageMode } from "@/lib/garage/GarageModeProvider";
import { HardHat } from "lucide-react";

export function GarageModeEntry() {
  const { enterGarageMode } = useGarageMode();

  return (
    <button
      type="button"
      onClick={enterGarageMode}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-garage-border bg-garage-bg px-3 text-sm font-medium text-garage-text hover:border-garage-orange hover:text-garage-orange"
      title="Large touch targets and optional voice for hands-free setup beside the welder"
    >
      <HardHat className="h-4 w-4" />
      Garage Mode
    </button>
  );
}
