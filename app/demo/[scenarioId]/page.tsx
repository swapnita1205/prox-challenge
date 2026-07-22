import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDemoScenario } from "@/lib/demo/scenarios";
import { DemoRunnerClient } from "@/components/demo/DemoRunnerClient";
import { hasValidApiKey } from "@/lib/env";
import { Skeleton } from "@/components/ui/skeleton";

interface DemoScenarioPageProps {
  params: Promise<{ scenarioId: string }>;
}

export default async function DemoScenarioPage({ params }: DemoScenarioPageProps) {
  const { scenarioId } = await params;
  const scenario = getDemoScenario(scenarioId);
  if (!scenario) notFound();

  const apiKeyConfigured = hasValidApiKey();

  return (
    <Suspense fallback={<DemoLoading />}>
      <DemoRunnerClient scenario={scenario} apiKeyConfigured={apiKeyConfigured} />
    </Suspense>
  );
}

function DemoLoading() {
  return (
    <div className="flex h-screen flex-col p-4" aria-label="Loading demo">
      <Skeleton className="mb-4 h-24 w-full" />
      <div className="flex flex-1 gap-4">
        <Skeleton className="flex-1" />
        <Skeleton className="hidden flex-1 lg:block" />
      </div>
    </div>
  );
}
