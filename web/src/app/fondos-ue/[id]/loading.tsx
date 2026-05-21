import { Skeleton } from "@/components/ui/skeleton"

export default function EuFundDetailLoading() {
  return (
    <div className="ui-page">
      <Skeleton className="h-8 rounded" />
      <Skeleton className="h-40 rounded" />
      <Skeleton className="h-32 rounded" />
      <Skeleton className="h-28 rounded" />
    </div>
  )
}
