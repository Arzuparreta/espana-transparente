import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[2px] bg-muted", className)}
    />
  )
}

export function PageSkeleton({
  cards = 6,
  withStats = false,
}: {
  cards?: number
  withStats?: boolean
}) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      {withStats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      ) : null}

      <div className="ui-grid-cards">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    </div>
  )
}

export function DetailPageSkeleton({
  cards = 4,
  withStats = true,
}: {
  cards?: number
  withStats?: boolean
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-40" />

      {withStats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
    </div>
  )
}
