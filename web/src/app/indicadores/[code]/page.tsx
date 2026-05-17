import { notFound } from "next/navigation"
import { ArrowLeft, Database } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IndicatorChart } from "@/components/indicators/IndicatorChart"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getIndicatorPoints } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ code: string }>
}

interface Row {
  period: string
  value: number | string
  unit: string | null
  indicator_name: string
}

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
})

function formatValue(value: number) {
  return numberFormatter.format(value)
}

function formatDelta(change: number | null) {
  if (change === null || !Number.isFinite(change)) return "Sin comparación"
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
}

export default async function IndicadorPage({ params }: PageProps) {
  const { code } = await params

  const points = await getIndicatorPoints(code)

  if (!points || points.length === 0) notFound()

  const pts = (points as unknown as Row[])
    .map((point) => ({
      ...point,
      value: Number(point.value),
      unit: point.unit ?? "",
    }))
    .filter((point) => Number.isFinite(point.value))

  if (pts.length === 0) notFound()

  const name = pts[0].indicator_name
  const unit = pts[0].unit
  const sorted = [...pts].reverse()
  const latest = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const change = prev && prev.value !== 0 ? ((latest.value - prev.value) / prev.value) * 100 : null
  const values = sorted.map((point) => point.value)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const rangeStart = sorted[0]?.period
  const rangeEnd = sorted[sorted.length - 1]?.period

  const stats = [
    { label: "Periodo", value: latest.period, hint: "Última observación" },
    { label: "Variación", value: formatDelta(change), hint: "Respecto al dato anterior" },
    { label: "Máximo", value: formatValue(max), hint: unit },
    { label: "Mínimo", value: formatValue(min), hint: unit },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="relative min-h-[calc(100svh-7.5rem)] overflow-hidden rounded-xl border border-border/80 bg-[radial-gradient(circle_at_8%_0%,hsl(var(--brand-signal)/0.26),transparent_34%),linear-gradient(135deg,#f5f2ec_0%,#c9c9c4_36%,#151515_100%)] p-3 text-white shadow-sm sm:p-4">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />
        <div className="relative flex min-h-[calc(100svh-9.5rem)] flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-lg border border-white/15 bg-black/24 px-3 py-3 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ResponsiveLink
                  href="/indicadores"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white/72 transition-colors hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Indicadores
                </ResponsiveLink>
                <Badge variant="outline" className="border-white/25 bg-white/10 text-[10px] text-white">
                  {code}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/70">
                  <Database className="h-3.5 w-3.5" aria-hidden="true" />
                  INE
                </span>
              </div>
              <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
                {name}
              </h1>
            </div>
            <div className="shrink-0 rounded-lg border border-white/15 bg-black/24 px-3 py-2 sm:text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">Último dato</div>
              <div className="mt-1 flex flex-wrap items-end gap-2 sm:justify-end">
                <span className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                  {formatValue(latest.value)}
                </span>
                <span className="pb-1 text-xs text-white/66">{unit}</span>
              </div>
            </div>
          </div>

          <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-h-[44svh] rounded-lg border border-white/15 bg-black/26 p-2 backdrop-blur sm:min-h-[52svh] sm:p-3 lg:min-h-0">
              <IndicatorChart
                data={sorted.map((point) => ({ period: point.period, value: point.value }))}
                unit={unit}
                variant="stage"
                heightClassName="h-full min-h-[44svh] sm:min-h-[52svh] lg:min-h-0"
                className="h-full text-white"
              />
            </div>

            <aside className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-white/15 bg-black/24 px-3 py-3 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/62">{stat.label}</div>
                  <div className="mt-1 break-words font-display text-3xl font-semibold tracking-tight">{stat.value}</div>
                  <div className="mt-1 text-xs leading-5 text-white/62">{stat.hint}</div>
                </div>
              ))}
            </aside>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-xs text-white/66 backdrop-blur">
            <span>{sorted.length} observaciones</span>
            <span>{rangeStart} - {rangeEnd}</span>
          </div>
        </div>
      </section>

      <details className="text-sm">
        <summary className="mb-3 cursor-pointer text-muted-foreground hover:text-foreground">
          Ver tabla completa de datos
        </summary>
        <Card>
          <CardContent className="max-h-[320px] overflow-y-auto p-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="p-2 text-left font-medium">Periodo</th>
                  <th className="p-2 text-right font-medium">Valor</th>
                  <th className="p-2 text-right font-medium">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((point, index) => (
                  <tr key={index} className="border-b border-muted/30">
                    <td className="p-2">{point.period}</td>
                    <td className="p-2 text-right font-medium">{formatValue(point.value)}</td>
                    <td className="p-2 text-right text-muted-foreground">{point.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </details>
    </div>
  )
}
