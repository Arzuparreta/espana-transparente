"use client"

import { Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { IndicatorCard } from "@/components/indicators/IndicatorCard"
import { groupIndicators } from "@/lib/indicator-groups"

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

function CardGrid({ items }: { items: IndicatorSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((indicator) => (
        <IndicatorCard key={indicator.code} indicator={indicator} />
      ))}
    </div>
  )
}

export function IndicatorsDashboard({ indicators, totalObservations }: IndicatorsDashboardProps) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()

  const sortedPeriods = indicators
    .map((indicator) => indicator.latestPeriod)
    .sort()
  const latestPeriod = sortedPeriods[sortedPeriods.length - 1]

  const groups = useMemo(() => groupIndicators(indicators), [indicators])

  const filtered = useMemo(() => {
    if (!normalizedQuery) return indicators

    return indicators.filter((indicator) => {
      const haystack = `${indicator.name} ${indicator.code} ${indicator.unit}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [indicators, normalizedQuery])

  const foldedCount = groups.ipcSubgrupos.length + groups.ipcAvanzado.length

  return (
    <div className="space-y-5">
      <section className="hidden overflow-hidden rounded-[2px] border border-border bg-card p-4 sm:block sm:p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3">
            <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Series</div>
            <div data-value className="mt-1 font-mono text-3xl font-medium tracking-tight">{indicators.length}</div>
          </div>
          <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3">
            <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Observaciones</div>
            <div data-value className="mt-1 font-mono text-3xl font-medium tracking-tight">{totalObservations}</div>
          </div>
          <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3">
            <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Último periodo</div>
            <div data-value className="mt-1 font-mono text-3xl font-medium tracking-tight">{latestPeriod ?? "N/D"}</div>
          </div>
          <div className="rounded-[2px] border border-border bg-background/60 px-3 py-3">
            <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Fuentes</div>
            <div data-value className="mt-1 font-mono text-2xl font-medium leading-9 tracking-tight">INE · Eurostat</div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-[2px] border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Panel de indicadores</div>
          <div className="text-xs leading-5 text-muted-foreground">
            {normalizedQuery
              ? `${filtered.length} de ${indicators.length} series visibles`
              : `${groups.principal.length} series visibles · ${foldedCount} plegadas`}
          </div>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, código o unidad"
            className="h-10 rounded-[2px] pl-8"
            aria-label="Buscar indicadores"
          />
        </label>
      </div>

      {normalizedQuery ? (
        filtered.length === 0 ? (
          <div className="rounded border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No hay indicadores que coincidan con la búsqueda.
          </div>
        ) : (
          <CardGrid items={filtered} />
        )
      ) : (
        <>
          <CardGrid items={groups.principal} />

          {groups.ipcSubgrupos.length > 0 ? (
            <details className="rounded-[2px] border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                Subgrupos del IPC ({groups.ipcSubgrupos.length} series)
              </summary>
              <div className="mt-4">
                <CardGrid items={groups.ipcSubgrupos} />
              </div>
            </details>
          ) : null}

          {groups.ipcAvanzado.length > 0 ? (
            <details className="rounded-[2px] border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
                Series avanzadas del IPC: índice mensual y variaciones ({groups.ipcAvanzado.length})
              </summary>
              <div className="mt-4">
                <CardGrid items={groups.ipcAvanzado} />
              </div>
            </details>
          ) : null}
        </>
      )}
    </div>
  )
}
