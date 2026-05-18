import type { ReactNode } from "react"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

interface AnchorCardProps {
  label: string
  value: ReactNode
  description?: ReactNode
  source?: string
  href?: string
  linkLabel?: string
  className?: string
}

export function AnchorCard({
  label,
  value,
  description,
  source,
  href,
  linkLabel = "Ver detalle →",
  className,
}: AnchorCardProps) {
  return (
    <section
      className={cn(
        "flex min-h-[260px] flex-col rounded-2xl border border-border/70 bg-card/85 px-6 py-6 shadow-sm sm:px-7 sm:py-7",
        className
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 font-display text-3xl font-semibold tabular-nums tracking-[-0.045em] text-foreground sm:text-4xl">
        {value}
      </div>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {source ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{source}</p>
      ) : null}
      {href ? (
        <ResponsiveLink
          href={href}
          className="mt-auto inline-flex min-h-11 items-end pt-4 text-sm font-semibold underline underline-offset-4 hover:text-foreground"
        >
          {linkLabel}
        </ResponsiveLink>
      ) : null}
    </section>
  )
}
