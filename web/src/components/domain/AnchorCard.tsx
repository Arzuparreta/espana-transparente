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
  variant?: "default" | "compact"
}

export function AnchorCard({
  label,
  value,
  description,
  source,
  href,
  linkLabel = "Ver detalle →",
  className,
  variant = "default",
}: AnchorCardProps) {
  const compact = variant === "compact"
  return (
    <section
      className={cn(
        "flex flex-col rounded border border-border bg-card",
        compact
          ? "min-h-[150px] px-4 py-4 sm:px-5"
          : "min-h-[260px] px-5 py-6 sm:px-6 sm:py-7",
        className
      )}
    >
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div
        data-value
        className={cn(
          "mt-2 font-mono font-medium tracking-[-0.08em] text-foreground",
          compact ? "text-2xl" : "text-3xl sm:text-4xl"
        )}
      >
        {value}
      </div>
      {description ? (
        <p
          className={cn(
            "mt-3 max-w-2xl text-muted-foreground",
            compact ? "text-xs leading-5" : "text-sm leading-6"
          )}
        >
          {description}
        </p>
      ) : null}
      {source ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{source}</p>
      ) : null}
      {href ? (
        <ResponsiveLink
          href={href}
          className={cn(
            "mt-auto inline-flex items-end pt-4 font-semibold underline underline-offset-4 hover:text-foreground",
            compact ? "min-h-9 text-xs" : "min-h-11 text-sm"
          )}
        >
          {linkLabel}
        </ResponsiveLink>
      ) : null}
    </section>
  )
}
