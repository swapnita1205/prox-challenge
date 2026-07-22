import { Suspense } from "react";
import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";
import { Skeleton } from "@/components/ui/skeleton";
import { hasValidApiKey } from "@/lib/env";

export default function WorkspacePage() {
  const apiKeyConfigured = hasValidApiKey();

  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <WorkspaceClient apiKeyConfigured={apiKeyConfigured} />
    </Suspense>
  );
}

function WorkspaceLoading() {
  return (
    <div className="flex h-screen flex-col p-4" aria-label="Loading workspace">
      <Skeleton className="mb-4 h-10 w-48" />
      <div className="flex flex-1 gap-4">
        <Skeleton className="flex-1" />
        <Skeleton className="hidden flex-1 lg:block" />
      </div>
    </div>
  );
}
