import type { CSSProperties, ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatItem {
  label: string
  value: ReactNode
  hint?: ReactNode
  valueClassName?: string
}

interface StatGridProps {
  items: StatItem[]
  className?: string
  /**
   * "cards" (default): boxed stat cards for index/list pages.
   * "flat": borderless figures strip for detail ("Expediente") pages — columns
   * separated only by the surrounding section rules, no card boxes.
   */
  variant?: "cards" | "flat"
}

function StatCell({ item }: { item: StatItem }) {
  return (
    <>
      <div className="break-words font-mono text-xs font-normal uppercase tracking-[0.1em] text-muted-foreground">
        {item.label}
      </div>
      <div
        data-value
        className={cn("break-words font-mono text-3xl font-medium tracking-[-0.03em]", item.valueClassName)}
      >
        {item.value}
      </div>
      {item.hint ? (
        <div className="break-words text-xs leading-5 text-muted-foreground">{item.hint}</div>
      ) : null}
    </>
  )
}

export function StatGrid({ items, className, variant = "cards" }: StatGridProps) {
  const desktopColumns = Math.max(1, items.length)
  const style = {
    "--stat-grid-desktop-columns": desktopColumns,
  } as CSSProperties

  const gridClass =
    "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--stat-grid-desktop-columns),minmax(0,1fr))]"

  if (variant === "flat") {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--stat-grid-desktop-columns),minmax(0,1fr))]",
          className
        )}
        style={style}
      >
        {items.map((item) => (
          <div key={item.label} className="min-w-0 space-y-1">
            <StatCell item={item} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn(gridClass, className)} style={style}>
      {items.map((item) => (
        <Card key={item.label} className="min-w-0">
          <CardContent className="min-w-0 space-y-1 px-4 py-4">
            <StatCell item={item} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
