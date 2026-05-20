import { Skeleton } from "@/components/ui/skeleton"

export default function PerfilLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-36 rounded" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[520px] rounded" />
        <Skeleton className="h-64 rounded" />
      </div>
    </div>
  )
}
