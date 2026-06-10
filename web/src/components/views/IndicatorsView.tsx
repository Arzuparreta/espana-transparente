import { AnnualSeriesChart } from "@/components/chain/AnnualSeriesChart"
import { EmptyState } from "@/components/domain/EmptyState"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { IndicatorsDashboard, type IndicatorSummary } from "@/components/indicators/IndicatorsDashboard"
import {
  annualMeanVariation,
  CHAIN_SOURCES,
  deflateToBaseYear,
  extractAnnualPoints,
  toAnnualMeans,
} from "@/lib/annual-series"
import { getEtlLastFinished, getIndicators } from "@/lib/data"

/**
 * Series surface ("lo importante primero, lo fancy plegado"):
 *
 *   getIndicators() ──┬─▶ IPC monthly ──toAnnualMeans──▶ annualMeanVariation ──▶ chart 1 (IPC anual)
 *                     ├─▶ SALARIO_MEDIO ──deflateToBaseYear(IPC means)────────▶ chart 2 (nominal vs real)
 *                     ├─▶ DEUDA_PUBLICA ──extractAnnualPoints────────────────▶ chart 3 (stock, Eurostat)
 *                     └─▶ every series ──▶ IndicatorsDashboard (grouped, IPC detail folded)
 */
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

  // Chain charts: annual aggregation of series already loaded above.
  const byCode = new Map(indicators.map((indicator) => [indicator.code, indicator.points]))
  const pointsOf = (code: string) => byCode.get(code) ?? []

  const ipcMeans = toAnnualMeans(pointsOf("IPC"))
  const ipcAnnual = annualMeanVariation(ipcMeans)
  // Latest COMPLETE year of the IPC index — never hardcode the base year.
  const baseYear = ipcMeans.length > 0 ? ipcMeans[ipcMeans.length - 1].year : null
  const salaryNominal = extractAnnualPoints(pointsOf("SALARIO_MEDIO"))
  const salaryReal =
    baseYear !== null ? deflateToBaseYear(salaryNominal, ipcMeans, baseYear) : []
  const salaryYears = new Set(salaryReal.map((point) => point.year))
  const salaryNominalAligned = salaryNominal.filter((point) => salaryYears.has(point.year))
  const debt = extractAnnualPoints(pointsOf("DEUDA_PUBLICA"))

  const [ipcChecked, salaryChecked, debtChecked] = await Promise.all([
    getEtlLastFinished(["ine.indicadores"]),
    getEtlLastFinished(["ine.indicadores_ampliados", "ine.indicadores"]),
    getEtlLastFinished(["ine.bde"]),
  ])

  return (
    <div className="space-y-6 sm:space-y-8">
        {ipcAnnual.length >= 2 ? (
          <AnnualSeriesChart
            title="IPC general anual: lo que suben los precios cada año"
            subtitle="Variación de medias anuales del índice general (convención INE, base 2025). Solo años completos: el año en curso no aparece hasta cerrar sus 12 meses."
            kind="bars"
            valueFormat="percent"
            unitLabel="% anual"
            highlightLatest
            detailHref="/indicadores/IPC"
            series={[{ id: "ipc-anual", label: "IPC general", points: ipcAnnual }]}
            source={{
              ...CHAIN_SOURCES["ipc-anual"],
              lastChecked: ipcChecked,
              coverageLabel: `Años completos ${ipcAnnual[0].year}–${ipcAnnual[ipcAnnual.length - 1].year}`,
            }}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {salaryReal.length >= 2 && baseYear !== null ? (
            <AnnualSeriesChart
              title="Salario medio: nominal vs real"
              subtitle={`Salario bruto anual (EAES) deflactado por el IPC medio anual, en euros constantes de ${baseYear}. La EAES se publica con unos dos años de retraso.`}
              kind="lines"
              valueFormat="eurosYear"
              unitLabel={`€/año (euros de ${baseYear})`}
              detailHref="/indicadores/SALARIO_MEDIO"
              series={[
                {
                  id: "salario-real",
                  label: `Salario real (euros de ${baseYear})`,
                  points: salaryReal,
                  role: "primary",
                },
                {
                  id: "salario-nominal",
                  label: "Salario nominal",
                  points: salaryNominalAligned,
                  role: "secondary",
                },
              ]}
              source={{
                ...CHAIN_SOURCES["salario-real"],
                lastChecked: salaryChecked,
                coverageLabel: `Serie anual ${salaryReal[0].year}–${salaryReal[salaryReal.length - 1].year}`,
              }}
            />
          ) : null}

          {debt.length >= 2 ? (
            <AnnualSeriesChart
              title="Deuda pública: lo que debe el Estado"
              subtitle="Stock de deuda consolidada de las Administraciones Públicas, criterio de Maastricht."
              kind="lines"
              valueFormat="millionsEurBn"
              unitLabel="billones de €"
              detailHref="/indicadores/DEUDA_PUBLICA"
              series={[{ id: "deuda", label: "Deuda viva", points: debt }]}
              source={{
                ...CHAIN_SOURCES.deuda,
                lastChecked: debtChecked,
                coverageLabel: `Serie anual ${debt[0].year}–${debt[debt.length - 1].year}`,
              }}
            />
          ) : null}
        </div>

        {indicators.length === 0 ? (
          <EmptyState title="Sin indicadores" description="Ejecuta el ETL del INE." />
        ) : (
          <IndicatorsDashboard indicators={indicators} totalObservations={rows.length} />
        )}

        <InfoPanel title="Fuente">
          INE (IPC, EPA, EAES, Contabilidad Nacional) y Eurostat (deuda pública, criterio de
          Maastricht). Datos actualizados vía API JSON.
        </InfoPanel>
    </div>
  )
}
