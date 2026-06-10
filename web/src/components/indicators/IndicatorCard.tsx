import { ArrowUpRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { IndicatorSparkline } from "@/components/indicators/IndicatorSparkline"
import { CopyLinkButton } from "@/components/indicators/CopyLinkButton"
import type { IndicatorSummary } from "@/components/indicators/IndicatorsDashboard"
import { getIndicatorExplanation } from "@/lib/indicator-explanations"
import { cn } from "@/lib/utils"

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

function formatValue(value: number) {
  return numberFormatter.format(value)
}

function formatDelta(deltaPct: number | null) {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return "Sin comparación"
  const sign = deltaPct > 0 ? "+" : ""
  return `${sign}${deltaPct.toFixed(2)}%`
}

export function IndicatorCard({ indicator }: { indicator: IndicatorSummary }) {
  const trendClass =
    indicator.deltaPct === null
      ? "text-muted-foreground"
      : indicator.deltaPct >= 0
        ? "text-accent"
        : "text-muted-foreground"

  const explanation = getIndicatorExplanation(indicator.code)

  return (
    <article
      data-slot="card"
      className="group flex h-full min-h-[260px] flex-col justify-between rounded-[2px] border border-border bg-card p-4 transition-colors duration-150 hover:border-foreground/30"
    >
      <ResponsiveLink
        href={`/indicadores/${indicator.code}`}
        className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-base font-semibold leading-6 text-balance">{indicator.name}</h2>
              <div className="mt-1 text-xs text-muted-foreground">Último dato: {indicator.latestPeriod}</div>
            </div>
            <Badge variant="outline" className="shrink-0 text-xs">{indicator.code}</Badge>
          </div>

          <div>
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
              <span data-value className="font-mono text-4xl font-medium tracking-tight">
                {formatValue(indicator.latestValue)}
              </span>
              <span className="pb-1 text-xs text-muted-foreground">{indicator.unit}</span>
            </div>
            <div className={cn("mt-1 font-mono text-xs font-semibold", trendClass)}>
              {formatDelta(indicator.deltaPct)}
            </div>
          </div>

          {explanation.short && (
            <p className="text-xs leading-5 text-muted-foreground text-pretty">
              {explanation.short}
            </p>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <IndicatorSparkline points={indicator.points} className="text-foreground/85" />
          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold text-muted-foreground">
            <span className="min-w-0">Ver serie</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </ResponsiveLink>

      <div className="mt-2 border-t border-border/40 pt-2">
        <CopyLinkButton
          url={`/indicadores/${indicator.code}`}
          label="Copiar enlace"
        />
      </div>
    </article>
  )
}
