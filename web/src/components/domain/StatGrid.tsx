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
}

export function StatGrid({ items, className }: StatGridProps) {
  const desktopColumns = Math.max(1, items.length)
  const style = {
    "--stat-grid-desktop-columns": desktopColumns,
  } as CSSProperties

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:[grid-template-columns:repeat(var(--stat-grid-desktop-columns),minmax(0,1fr))]",
        className
      )}
      style={style}
    >
      {items.map((item) => (
        <Card key={item.label} className="min-w-0 bg-card/90">
          <CardContent className="min-w-0 space-y-1 px-4 py-4">
            <div className="break-words text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </div>
            <div className={cn("break-words font-display text-3xl font-semibold tracking-[-0.045em]", item.valueClassName)}>
              {item.value}
            </div>
            {item.hint ? (
              <div className="break-words text-xs leading-5 text-muted-foreground">{item.hint}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
