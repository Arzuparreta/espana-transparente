import { Skeleton } from "@/components/ui/skeleton"

export default function InstitucionDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-8 rounded" />
      <Skeleton className="h-44 rounded" />
      <Skeleton className="h-72 rounded" />
    </div>
  )
}
