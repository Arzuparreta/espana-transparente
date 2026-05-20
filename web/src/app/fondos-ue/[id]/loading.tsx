import { Skeleton } from "@/components/ui/skeleton"

export default function EuFundDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-8 rounded" />
      <Skeleton className="h-40 rounded" />
      <Skeleton className="h-32 rounded" />
      <Skeleton className="h-28 rounded" />
    </div>
  )
}
