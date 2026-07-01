import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface RecordColumn<T> {
  header: string
  cell: (row: T) => ReactNode
  /** Right-align + tabular-nums (amounts, counts, dates). */
  numeric?: boolean
  /** On mobile, render this column as the row's title line (name/link). */
  primary?: boolean
  /** Drop this column from the mobile stacked view. */
  hideOnMobile?: boolean
  className?: string
}

interface RecordTableProps<T> {
  columns: RecordColumn<T>[]
  rows: T[]
  keyFor: (row: T, index: number) => string
  /** Accessible description of the table. */
  caption?: string
  className?: string
}

/**
 * Dense forensic table for collections (contracts, subsidies, votes, board
 * members…). Replaces card-grids of related items. `<td>` cells inherit Geist
 * Mono site-wide (globals.css). Never depends on horizontal scroll on mobile:
 * `sm+` renders a real table, below `sm` it collapses to stacked label/value
 * rows (ui:audit requirement).
 */
export function RecordTable<T>({
  columns,
  rows,
  keyFor,
  caption,
  className,
}: RecordTableProps<T>) {
  const primary = columns.find((c) => c.primary)
  const secondary = columns.filter((c) => !c.primary && !c.hideOnMobile)

  return (
    <div className={cn("min-w-0", className)}>
      {/* Desktop: dense table */}
      <table className="hidden w-full border-collapse text-sm sm:table">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border">
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  "py-2 pr-4 text-left align-bottom font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground",
                  col.numeric && "pl-4 pr-0 text-right"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr
              key={keyFor(row, r)}
              className="border-b border-border/50 transition-colors hover:bg-muted/40"
            >
              {columns.map((col, c) => (
                <td
                  key={c}
                  className={cn(
                    "py-2.5 pr-4 align-top",
                    col.numeric && "pl-4 pr-0 text-right tabular-nums",
                    col.className
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: stacked rows */}
      <ul className="divide-y divide-border/50 text-sm sm:hidden">
        {rows.map((row, r) => (
          <li key={keyFor(row, r)} className="min-w-0 space-y-1.5 py-3">
            {primary ? (
              <div className="min-w-0 break-words font-medium">{primary.cell(row)}</div>
            ) : null}
            {secondary.map((col, c) => (
              <div
                key={c}
                className="flex min-w-0 items-baseline justify-between gap-3"
              >
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {col.header}
                </span>
                <span
                  className={cn(
                    "min-w-0 break-words text-right",
                    col.numeric && "font-mono tabular-nums"
                  )}
                >
                  {col.cell(row)}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
