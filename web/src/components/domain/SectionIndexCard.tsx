import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

export interface SectionIndexCardProps {
  href: string
  label: string
  description: string
  count?: number | null
  countUnit?: string
  latestDate?: string | null
  className?: string
}

function formatCount(value: number, unit?: string): string {
  const num = value.toLocaleString("es-ES")
  return unit ? `${num} ${unit}` : num
}

function formatDate(value: string): string | null {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function SectionIndexCard({
  href,
  label,
  description,
  count,
  countUnit,
  latestDate,
  className,
}: SectionIndexCardProps) {
  const showCount = count != null && Number.isFinite(count)
  const formattedDate = latestDate ? formatDate(latestDate) : null

  return (
    <ResponsiveLink
      href={href}
      className={cn(
        "group flex min-h-[120px] min-w-0 flex-col rounded-[2px] border border-border bg-card px-4 py-3.5 transition-colors hover:border-foreground/40 hover:bg-card/90",
        className
      )}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
        {showCount ? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatCount(count as number, countUnit)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground line-clamp-2">{description}</p>
      {formattedDate ? (
        <span className="mt-auto pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          Último dato · <span className="tabular-nums">{formattedDate}</span>
        </span>
      ) : null}
    </ResponsiveLink>
  )
}
