import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

interface FilterChipProps {
  label: string
  value: string
  clearHref: string
  clearLabel?: string
  className?: string
}

export function FilterChip({
  label,
  value,
  clearHref,
  clearLabel = "Quitar filtro ×",
  className,
}: FilterChipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm",
        className
      )}
    >
      <span className="text-muted-foreground">{label}:</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
      <ResponsiveLink
        href={clearHref}
        className="ml-auto shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        {clearLabel}
      </ResponsiveLink>
    </div>
  )
}
