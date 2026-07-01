import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface RecordLayoutProps {
  /** Case-sheet hero, rendered full width above the two-zone body. */
  hero: ReactNode
  /** Main column: a stack of RecordSection bands. */
  children: ReactNode
  /** Optional sticky evidence rail (sources + connections + metadata). */
  aside?: ReactNode
  className?: string
}

/**
 * The "Expediente" shell: a left-anchored case file. A full-width hero, then a
 * single authoritative column of rule-separated sections, with an optional
 * sticky evidence rail on desktop that stacks below on mobile.
 *
 * Replaces the ad-hoc `grid-cols-[minmax(0,1fr)_22rem]` sidebars that were
 * hand-copied across detail pages.
 */
export function RecordLayout({ hero, children, aside, className }: RecordLayoutProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {hero}
      {aside ? (
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-8">{children}</div>
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">{aside}</aside>
        </div>
      ) : (
        <div className="min-w-0 space-y-8">{children}</div>
      )}
    </div>
  )
}
