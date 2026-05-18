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
        "h-5 shrink-0 border-accent/30 bg-accent/10 text-xs text-accent dark:border-accent/40 dark:bg-accent/15 dark:text-accent",
        className
      )}
    >
      {count} diverg.
    </Badge>
  )
}
