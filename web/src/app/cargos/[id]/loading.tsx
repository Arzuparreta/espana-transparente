import { Skeleton } from "@/components/ui/skeleton"

export default function CargoDetailLoading() {
  return (
    <div className="ui-page">
      <Skeleton className="h-8 rounded" />
      <Skeleton className="h-44 rounded" />
      <Skeleton className="h-72 rounded" />
    </div>
  )
}
