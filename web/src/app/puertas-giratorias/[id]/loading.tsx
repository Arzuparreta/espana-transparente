import { Skeleton } from "@/components/ui/skeleton"

export default function RevolvingDoorDetailLoading() {
  return (
    <div className="ui-page">
      <Skeleton className="h-8 rounded" />
      <Skeleton className="h-40 rounded" />
      <Skeleton className="h-72 rounded" />
      <Skeleton className="h-32 rounded" />
    </div>
  )
}
