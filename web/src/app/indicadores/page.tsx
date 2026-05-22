import { EmptyState } from "@/components/domain/EmptyState"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PageHeader } from "@/components/domain/PageHeader"
import { IndicatorsDashboard, type IndicatorSummary } from "@/components/indicators/IndicatorsDashboard"
import { getIndicators } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Indicadores económicos",
  description: "Series del INE: IPC, PIB, EPA, deuda pública y otras magnitudes macroeconómicas.",
}

export default async function IndicadoresPage() {
  const rows = await getIndicators()

  const grouped: Record<string, IndicatorSummary> = {}
  for (const row of rows ?? []) {
    const value = Number(row.value)
    if (!Number.isFinite(value)) continue

    if (!grouped[row.indicator_code]) {
      grouped[row.indicator_code] = {
        code: row.indicator_code,
        name: row.indicator_name,
        unit: row.unit ?? "",
        latestPeriod: row.period,
        latestValue: value,
        previousValue: null,
        deltaAbs: null,
        deltaPct: null,
        points: [],
      }
    }

    grouped[row.indicator_code].points.push({
      period: row.period,
      value,
    })
  }

  const indicators = Object.values(grouped)
    .map((indicator) => {
      const points = [...indicator.points].reverse()
      const latest = points[points.length - 1]
      const previous = points[points.length - 2]
      const deltaAbs = previous ? latest.value - previous.value : null
      const deltaPct = previous && previous.value !== 0 ? (deltaAbs! / previous.value) * 100 : null

      return {
        ...indicator,
        latestPeriod: latest.period,
        latestValue: latest.value,
        previousValue: previous?.value ?? null,
        deltaAbs,
        deltaPct,
        points,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  return (
    <div className="ui-page">
        <PageHeader
          title="Indicadores económicos"
          description="Datos económicos generales del país: cuánto sube el IPC, cuánto crece el PIB, cuánta gente trabaja, cuánta deuda hay. Series del Instituto Nacional de Estadística (INE)."
        />

        {indicators.length === 0 ? (
          <EmptyState title="Sin indicadores" description="Ejecuta el ETL del INE." />
        ) : (
          <IndicatorsDashboard indicators={indicators} totalObservations={rows.length} />
        )}

        <InfoPanel title="Fuente">
          INE (Instituto Nacional de Estadística). Datos actualizados mensualmente vía API JSON.
        </InfoPanel>
    </div>
  )
}
