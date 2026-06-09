import { EmptyState } from "@/components/domain/EmptyState"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { IndicatorsDashboard, type IndicatorSummary } from "@/components/indicators/IndicatorsDashboard"
import { getIndicators } from "@/lib/data"

export async function IndicatorsView() {
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
    <div className="space-y-6 sm:space-y-8">
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
