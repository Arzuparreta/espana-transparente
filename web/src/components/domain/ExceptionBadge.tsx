import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ExceptionBadgeProps {
  count: number
  className?: string
}

export function ExceptionBadge({ count, className }: ExceptionBadgeProps) {
  return (
    <Badge
      className={cn(
        "h-5 shrink-0 border-amber-300 bg-amber-100 text-[10px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        className
      )}
    >
      {count} diverg.
    </Badge>
  )
}
