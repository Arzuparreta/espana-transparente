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
        "flex flex-col rounded-2xl border border-border/60 bg-card/60 px-6 py-7 sm:px-8 sm:py-8",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight text-foreground sm:text-4xl">
        {value}
      </div>
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {source ? (
        <p className="mt-2 text-xs text-muted-foreground">{source}</p>
      ) : null}
      {href ? (
        <ResponsiveLink
          href={href}
          className="mt-4 inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground"
        >
          {linkLabel}
        </ResponsiveLink>
      ) : null}
    </section>
  )
}
