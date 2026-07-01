import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface FieldItem {
  label: string
  value: ReactNode
  /** Render the value in Geist Mono (amounts, IDs, dates, counts). */
  mono?: boolean
}

interface FieldListProps {
  items: FieldItem[]
  className?: string
}

/**
 * The record's identity block — a definition list of label/value rows. Replaces
 * the hand-coded `grid grid-cols-[10rem_1fr]` detail rows duplicated across
 * contratos/subvenciones/iniciativas/corrupcion and the person "IDENTIDAD" block.
 *
 * Pass `mono: true` for numeric/ID/date values (per DESIGN.md).
 */
export function FieldList({ items, className }: FieldListProps) {
  return (
    <dl className={cn("text-sm", className)}>
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className="grid gap-1 border-t border-border/50 py-2.5 first:border-0 first:pt-0 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-4"
        >
          <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground sm:pt-0.5">
            {item.label}
          </dt>
          <dd
            className={cn(
              "min-w-0 break-words text-foreground",
              item.mono && "font-mono tabular-nums"
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
