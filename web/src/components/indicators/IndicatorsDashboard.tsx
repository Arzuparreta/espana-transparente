"use client"

import { ArrowUpRight, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { IndicatorSparkline } from "@/components/indicators/IndicatorSparkline"
import { cn } from "@/lib/utils"

export interface IndicatorPoint {
  period: string
  value: number
}

export interface IndicatorSummary {
  code: string
  name: string
  unit: string
  latestPeriod: string
  latestValue: number
  previousValue: number | null
  deltaAbs: number | null
  deltaPct: number | null
  points: IndicatorPoint[]
}

interface IndicatorsDashboardProps {
  indicators: IndicatorSummary[]
  totalObservations: number
}

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

export function IndicatorsDashboard({ indicators, totalObservations }: IndicatorsDashboardProps) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()

  const sortedPeriods = indicators
    .map((indicator) => indicator.latestPeriod)
    .sort()
  const latestPeriod = sortedPeriods[sortedPeriods.length - 1]

  const filtered = useMemo(() => {
    if (!normalizedQuery) return indicators

    return indicators.filter((indicator) => {
      const haystack = `${indicator.name} ${indicator.code} ${indicator.unit}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [indicators, normalizedQuery])

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border/80 bg-[radial-gradient(circle_at_10%_0%,hsl(var(--brand-signal)/0.24),transparent_34%),linear-gradient(135deg,#f7f4ef_0%,#d8d8d3_42%,#171717_100%)] p-4 text-white shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">Series</div>
            <div className="mt-1 font-display text-3xl font-semibold tracking-tight">{indicators.length}</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">Observaciones</div>
            <div className="mt-1 font-display text-3xl font-semibold tracking-tight">{totalObservations}</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">Último periodo</div>
            <div className="mt-1 font-display text-3xl font-semibold tracking-tight">{latestPeriod ?? "N/D"}</div>
          </div>
          <div className="rounded-lg border border-white/15 bg-black/20 px-3 py-3 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">Fuente</div>
            <div className="mt-1 font-display text-3xl font-semibold tracking-tight">INE</div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Panel de indicadores</div>
          <div className="text-xs leading-5 text-muted-foreground">
            {filtered.length} de {indicators.length} series visibles
          </div>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, código o unidad"
            className="h-10 rounded-md pl-8"
            aria-label="Buscar indicadores"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/70 px-4 py-10 text-center text-sm text-muted-foreground">
          No hay indicadores que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((indicator) => {
            const trendClass =
              indicator.deltaPct === null
                ? "text-muted-foreground"
                : indicator.deltaPct >= 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-700 dark:text-green-400"

            return (
              <ResponsiveLink
                key={indicator.code}
                href={`/indicadores/${indicator.code}`}
                className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <article
                  data-slot="card"
                  className="flex h-full min-h-[230px] flex-col justify-between rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/25 group-hover:shadow-md"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-base font-semibold leading-6 text-balance">{indicator.name}</h2>
                        <div className="mt-1 text-xs text-muted-foreground">Último dato: {indicator.latestPeriod}</div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{indicator.code}</Badge>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                        <span className="font-display text-4xl font-semibold tracking-tight">
                          {formatValue(indicator.latestValue)}
                        </span>
                        <span className="pb-1 text-xs text-muted-foreground">{indicator.unit}</span>
                      </div>
                      <div className={cn("mt-1 text-xs font-semibold", trendClass)}>
                        {formatDelta(indicator.deltaPct)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <IndicatorSparkline points={indicator.points} className="text-foreground/85" />
                    <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs font-semibold text-muted-foreground">
                      <span>Ver serie</span>
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                    </div>
                  </div>
                </article>
              </ResponsiveLink>
            )
          })}
        </div>
      )}
    </div>
  )
}
