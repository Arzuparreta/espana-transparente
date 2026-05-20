import { Skeleton } from "@/components/ui/skeleton"

export default function UsuarioLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-52 rounded" />
      <Skeleton className="h-64 rounded" />
    </div>
  )
}
