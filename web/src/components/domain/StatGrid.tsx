import type { ReactNode } from "react"
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
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((item) => (
        <Card key={item.label} className="bg-card/90">
          <CardContent className="space-y-1 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </div>
            <div className={cn("font-display text-3xl font-semibold tracking-[-0.045em]", item.valueClassName)}>
              {item.value}
            </div>
            {item.hint ? (
              <div className="text-xs leading-5 text-muted-foreground">{item.hint}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
