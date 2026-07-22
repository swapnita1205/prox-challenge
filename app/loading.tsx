import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-4 h-32 w-full max-w-md" />
    </div>
  );
}
