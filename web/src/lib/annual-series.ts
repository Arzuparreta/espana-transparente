/**
 * Pure helpers for annual aggregation of economic series.
 *
 * Powers the chain charts (IPC anual, salario real, deuda): annual means of
 * monthly series following the INE "variación de medias anuales" convention
 * (only complete 12-month years count), deflation to constant euros, and the
 * canonical source attributions that every chain chart must display.
 *
 *   monthly index ──toAnnualMeans──▶ annual means ──annualMeanVariation──▶ % per year
 *                                        │
 *   nominal annual series ──deflateToBaseYear(means, baseYear)──▶ real series
 *
 * No recharts here: the future /api/og route (Hito 3) imports this module
 * directly to render server-side.
 */

export interface SeriesPoint {
  period: string
  value: number
}

export interface AnnualPoint {
  year: number
  value: number
}

/**
 * Parses the period formats used in `economic_indicators`:
 * "YYYY" (annual, e.g. debt), "YYYY-A" (EAES annual), "YYYY-MM" (monthly).
 * Returns null for quarterly ("YYYY-T1"), malformed input, or month outside 1-12.
 */
export function parseAnnualPeriod(
  period: string
): { year: number; month: number | null } | null {
  if (/^\d{4}$/.test(period)) {
    return { year: Number(period), month: null }
  }
  if (/^\d{4}-A$/.test(period)) {
    return { year: Number(period.slice(0, 4)), month: null }
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const year = Number(period.slice(0, 4))
    const month = Number(period.slice(5, 7))
    if (month < 1 || month > 12) return null
    return { year, month }
  }
  return null
}

/**
 * Annual means of a monthly series. INE "media anual" convention: only
 * COMPLETE years (exactly 12 distinct months with finite values) are emitted;
 * the in-progress year and years with gaps are dropped. Duplicate periods
 * dedupe last-wins. Ascending by year.
 */
export function toAnnualMeans(points: SeriesPoint[]): AnnualPoint[] {
  const byYear = new Map<number, Map<number, number>>()

  for (const point of points) {
    const parsed = parseAnnualPeriod(point.period)
    if (!parsed || parsed.month === null) continue
    let months = byYear.get(parsed.year)
    if (!months) {
      months = new Map()
      byYear.set(parsed.year, months)
    }
    months.set(parsed.month, point.value)
  }

  const means: AnnualPoint[] = []
  byYear.forEach((months, year) => {
    if (months.size !== 12) return
    const values = Array.from(months.values())
    if (values.some((value) => !Number.isFinite(value))) return
    const sum = values.reduce((acc, value) => acc + value, 0)
    means.push({ year, value: sum / 12 })
  })

  return means.sort((a, b) => a.year - b.year)
}

/**
 * INE "variación de medias anuales": (mean[y] / mean[y-1] - 1) * 100.
 * Emits a point for year y only when y-1 is also present (never bridges a
 * gap year) and mean[y-1] is a non-zero finite value. The first year of the
 * series is never emitted.
 */
export function annualMeanVariation(means: AnnualPoint[]): AnnualPoint[] {
  const byYear = new Map(means.map((point) => [point.year, point.value]))
  const variation: AnnualPoint[] = []

  for (const point of [...means].sort((a, b) => a.year - b.year)) {
    const previous = byYear.get(point.year - 1)
    if (previous === undefined || !Number.isFinite(previous) || previous === 0) continue
    if (!Number.isFinite(point.value)) continue
    variation.push({ year: point.year, value: (point.value / previous - 1) * 100 })
  }

  return variation
}

/**
 * Deflates a nominal annual series to constant euros of baseYear:
 * real[y] = nominal[y] * (index[baseYear] / index[y]).
 * Years missing from the index, or with index <= 0, are dropped.
 * Returns [] when baseYear itself is not in the index (or not positive).
 */
export function deflateToBaseYear(
  nominal: AnnualPoint[],
  index: AnnualPoint[],
  baseYear: number
): AnnualPoint[] {
  const indexByYear = new Map(index.map((point) => [point.year, point.value]))
  const base = indexByYear.get(baseYear)
  if (base === undefined || !Number.isFinite(base) || base <= 0) return []

  const real: AnnualPoint[] = []
  for (const point of [...nominal].sort((a, b) => a.year - b.year)) {
    const idx = indexByYear.get(point.year)
    if (idx === undefined || !Number.isFinite(idx) || idx <= 0) continue
    if (!Number.isFinite(point.value)) continue
    real.push({ year: point.year, value: point.value * (base / idx) })
  }

  return real
}

/**
 * Picks the rows whose period is annual ("YYYY" or "YYYY-A"), dropping
 * monthly/quarterly rows and non-finite values. Duplicate years dedupe
 * last-wins. Ascending by year.
 */
export function extractAnnualPoints(points: SeriesPoint[]): AnnualPoint[] {
  const byYear = new Map<number, number>()

  for (const point of points) {
    const parsed = parseAnnualPeriod(point.period)
    if (!parsed || parsed.month !== null) continue
    if (!Number.isFinite(point.value)) continue
    byYear.set(parsed.year, point.value)
  }

  return Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year)
}

/**
 * Declarative value formatting, serializable across the RSC boundary
 * (client chart components cannot receive formatter callbacks from the server).
 */
export type AnnualValueFormat = "percent" | "eurosYear" | "millionsEurBn" | "plain"

const percentFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const eurosFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
})

const billionsFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const plainFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 1,
})

export function formatAnnualValue(value: number, format: AnnualValueFormat): string {
  switch (format) {
    case "percent": {
      const sign = value > 0 ? "+" : ""
      return `${sign}${percentFormatter.format(value)}%`
    }
    case "eurosYear":
      return `${eurosFormatter.format(value)} €`
    case "millionsEurBn":
      return `${billionsFormatter.format(value / 1_000_000)} B€`
    case "plain":
      return plainFormatter.format(value)
  }
}

/**
 * Canonical source attributions for the chain charts, defined ONCE so the
 * Hito 3 OG receipt (/api/og) burns the exact same strings into pixels.
 * Debt attribution is Eurostat (Maastricht criterion) — never "BdE", even
 * though the ETL module is historically named bde.py.
 */
export const CHAIN_SOURCES: Record<
  "ipc-anual" | "salario-real" | "deuda",
  { sourceLabel: string; sourceHref: string }
> = {
  "ipc-anual": {
    sourceLabel: "INE — IPC, índice general (base 2025=100), variación de medias anuales",
    sourceHref: "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/IPC290751?tip=A&nult=360",
  },
  "salario-real": {
    sourceLabel:
      "INE — Encuesta Anual de Estructura Salarial (EAES); deflactor: IPC medio anual (INE)",
    sourceHref: "https://servicios.ine.es/wstempus/js/ES/DATOS_SERIE/EAES354?tip=A&nult=500",
  },
  deuda: {
    sourceLabel: "Eurostat — gov_10dd_edpt1, deuda bruta consolidada (criterio de Maastricht)",
    sourceHref: "https://ec.europa.eu/eurostat/databrowser/view/gov_10dd_edpt1/default/table?lang=en",
  },
}
