import { notFound } from "next/navigation"
import { ArrowLeft, Database } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IndicatorChart } from "@/components/indicators/IndicatorChart"
import { CopyLinkButton } from "@/components/indicators/CopyLinkButton"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getIndicatorPoints, getIpcIndexSeries, getIpcSubgroupSeries } from "@/lib/data"
import { getIndicatorExplanation } from "@/lib/indicator-explanations"
import { PurchasingPowerCalculator } from "@/components/indicators/PurchasingPowerCalculator"
import { SalaryVsIpcCalculator } from "@/components/indicators/SalaryVsIpcCalculator"
import { IpcBasketCalculator } from "@/components/indicators/IpcBasketCalculator"
import { DebtPerCapitaContext } from "@/components/indicators/DebtPerCapitaContext"
import { computeDebtPerCapita, getDebtContext } from "@/lib/debt-per-capita"

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

  const explanation = getIndicatorExplanation(code)
  const detailUrl = `/indicadores/${code}`
  const ipcSeries =
    code === "IPC" || code === "SALARIO_MEDIO"
      ? await getIpcIndexSeries()
      : null

  const ipcSubgroups =
    code === "IPC"
      ? await getIpcSubgroupSeries()
      : null

  const [debtPerCapitaData, salaryPoints] =
    code === "DEUDA_PUBLICA"
      ? await Promise.all([
          (async () => {
            const perCapitaSeries = computeDebtPerCapita(
              pts.map((p) => ({ period: p.period, value: p.value, unit: p.unit }))
            )
            const context = getDebtContext(perCapitaSeries)
            return { perCapitaSeries, context }
          })(),
          getIndicatorPoints("SALARIO_MEDIO"),
        ])
      : [null, null]

  const latestSalary = salaryPoints?.length
    ? Number(
        [...salaryPoints].sort(
          (a, b) => a.period.localeCompare(b.period)
        )[salaryPoints.length - 1].value
      )
    : null

  return (
    <div className="ui-page">
        <ContextTrail
          section={{ href: "/indicadores", label: "Indicadores" }}
          current={name}
          meta={code}
          fallbackHref="/indicadores"
          fallbackLabel="Volver a Indicadores"
          related={[
            { href: "/estado-datos", label: "Estado de los datos" },
          ]}
        />
        <section className="relative min-h-[calc(100svh-7.5rem)] overflow-hidden rounded-[2px] border border-border bg-card p-3 sm:p-4">
          <div className="relative flex min-h-[calc(100svh-9.5rem)] flex-col gap-3">
            <div className="flex flex-col gap-3 rounded-[2px] border border-border bg-background/60 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ResponsiveLink
                    href="/indicadores"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Indicadores
                  </ResponsiveLink>
                  <Badge variant="outline" className="text-xs">
                    {code}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Database className="h-3.5 w-3.5" aria-hidden="true" />
                    INE
                  </span>
                  <CopyLinkButton url={detailUrl} />
                </div>
                <h1 className="font-display text-2xl font-black uppercase leading-tight tracking-[-0.02em] text-balance sm:text-4xl">
                  {name}
                </h1>
              </div>
              <div className="shrink-0 rounded-[2px] border border-border bg-card px-3 py-2 sm:text-right">
                <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Último dato</div>
                <div className="mt-1 flex flex-wrap items-end gap-2 sm:justify-end">
                  <span data-value className="font-mono text-4xl font-medium tracking-tight sm:text-5xl">
                    {formatValue(latest.value)}
                  </span>
                  <span className="pb-1 text-xs text-muted-foreground">{unit}</span>
                </div>
              </div>
            </div>

            <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-h-[44svh] rounded-[2px] border border-border bg-background/60 p-2 sm:min-h-[52svh] sm:p-3 lg:min-h-0">
                <IndicatorChart
                  data={sorted.map((point) => ({ period: point.period, value: point.value }))}
                  unit={unit}
                  variant="stage"
                  heightClassName="h-full min-h-[44svh] sm:min-h-[52svh] lg:min-h-0"
                  className="h-full text-foreground"
                />
              </div>

              <aside className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-[2px] border border-border bg-background/60 px-3 py-3">
                    <div className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">{stat.label}</div>
                    <div data-value className="mt-1 break-words font-mono text-3xl font-medium tracking-tight">{stat.value}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{stat.hint}</div>
                  </div>
                ))}
              </aside>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-border bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground">
              <span>{sorted.length} observaciones</span>
              <span>{rangeStart} - {rangeEnd}</span>
            </div>
          </div>
        </section>

        {(explanation.long || explanation.implications.length > 0) && (
          <section className="space-y-4">
            {explanation.long && (
              <p className="text-sm leading-6 text-muted-foreground text-pretty">
                {explanation.long}
              </p>
            )}

            {explanation.implications.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                  ¿Qué significa esto para ti?
                </summary>
                <ul className="mt-3 space-y-2 pl-4 text-muted-foreground">
                  {explanation.implications.map((item, i) => (
                    <li key={i} className="list-disc text-pretty leading-6">
                      {item}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {debtPerCapitaData?.context && (
          <DebtPerCapitaContext
            context={debtPerCapitaData.context}
            series={debtPerCapitaData.perCapitaSeries}
            annualSalary={latestSalary}
          />
        )}

        {ipcSubgroups && ipcSubgroups.length > 1 && code === "IPC" && (
          <IpcBasketCalculator series={ipcSubgroups} />
        )}

        {ipcSeries && ipcSeries.length > 1 && (
          <>
            {code === "SALARIO_MEDIO" && (
              <SalaryVsIpcCalculator series={ipcSeries} />
            )}
            {code === "IPC" && (
              <PurchasingPowerCalculator series={ipcSeries} />
            )}
          </>
        )}

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
