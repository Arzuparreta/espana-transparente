import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface RecordSectionProps {
  title: string
  /** Optional record count, rendered in mono next to the title. */
  count?: number | null
  /** Small mono uppercase context line above the title. */
  eyebrow?: ReactNode
  /** Right-aligned actions (filters, links). */
  actions?: ReactNode
  /** Anchor id for in-page navigation / SectionTabs scroll. */
  id?: string
  className?: string
  children: ReactNode
}

/**
 * A labelled band in the case file — NOT a card. A section heading with a top
 * hairline rule; content flows full width below. This replaces boxed `<Card>`
 * sections on detail pages so the page reads as one document, not a dashboard
 * of containers.
 */
export function RecordSection({
  title,
  count,
  eyebrow,
  actions,
  id,
  className,
  children,
}: RecordSectionProps) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 border-t border-border pt-5", className)}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="font-display text-xl font-black uppercase leading-none tracking-[-0.02em] sm:text-2xl">
            {title}
            {count != null ? (
              <span className="ml-2 align-baseline font-mono text-base font-normal uppercase tracking-normal text-muted-foreground tabular-nums">
                {count.toLocaleString("es-ES")}
              </span>
            ) : null}
          </h2>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}
