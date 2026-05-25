import { EntityTrailSkeleton } from "@/components/domain/EntityTrail"

export default function RastroLoading() {
  return (
    <div className="space-y-8">
      <div className="h-20 animate-pulse rounded bg-muted" />
      <EntityTrailSkeleton />
    </div>
  )
}
