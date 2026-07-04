import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
  /**
   * "panel" (default): boxed card header for index/list pages.
   * "record": flat, left-anchored case-sheet hero for detail pages — no box,
   * just a bottom hairline, with a larger display title.
   */
  variant?: "panel" | "record"
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
  variant = "panel",
}: PageHeaderProps) {
  const isRecord = variant === "record"
  const titleWordCount = title.trim().split(/\s+/).filter(Boolean).length
  const hasLongToken = title.split(/\s+/).some((word) => word.length > 18)
  const isLongTitle = title.length > 72 || titleWordCount > 9 || hasLongToken
  const isVeryLongTitle = title.length > 140 || titleWordCount > 18

  return (
    <section
      className={cn(
        "flex flex-col gap-4",
        isRecord
          ? "border-b border-border pb-5"
          : "rounded-[2px] border border-border bg-card px-4 py-5 sm:px-6 sm:py-6",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4",
          actions && !isLongTitle ? "sm:flex-row sm:items-start sm:justify-between" : null
        )}
      >
        <div className="min-w-0 max-w-full space-y-2">
          {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
          <div className="space-y-1">
            <h1
              className={cn(
                "max-w-none font-display font-black break-words",
                isLongTitle
                  ? "normal-case leading-[1.08] tracking-[-0.01em] text-pretty"
                  : "uppercase leading-[0.9] tracking-[-0.03em] text-balance",
                !isLongTitle && (isRecord ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl"),
                isLongTitle && isVeryLongTitle
                  ? "text-[clamp(1.45rem,5.8vw,3.5rem)]"
                  : isLongTitle && isRecord
                    ? "text-[clamp(1.65rem,6.4vw,4rem)]"
                    : isLongTitle
                      ? "text-[clamp(1.55rem,5.6vw,3.5rem)]"
                      : null
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </section>
  )
}
