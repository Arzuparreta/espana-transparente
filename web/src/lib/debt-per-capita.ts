/**
 * Approximate Spanish population by year (INE data, July 1 estimates).
 * Used for debt-per-capita calculations. Values in millions.
 * Linear interpolation is used for years between entries.
 *
 * Source: INE — Cifras oficiales de población (various years).
 */
const POPULATION_DATA: Record<number, number> = {
  1995: 39.30,
  1996: 39.67,
  1997: 39.90,
  1998: 40.10,
  1999: 40.20,
  2000: 40.40,
  2001: 41.10,
  2002: 41.83,
  2003: 42.72,
  2004: 43.20,
  2005: 43.40,
  2006: 44.10,
  2007: 45.20,
  2008: 46.10,
  2009: 46.39,
  2010: 46.60,
  2011: 46.67,
  2012: 46.73,
  2013: 46.59,
  2014: 46.51,
  2015: 46.44,
  2016: 46.53,
  2017: 46.62,
  2018: 46.72,
  2019: 47.10,
  2020: 47.33,
  2021: 47.43,
  2022: 47.61,
  2023: 48.08,
  2024: 48.60,
}

const years = Object.keys(POPULATION_DATA).map(Number).sort((a, b) => a - b)
const minYear = years[0]
const maxYear = years[years.length - 1]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Returns approximate Spanish population for a given year in millions.
 * Uses linear interpolation between known INE data points.
 * For years outside the range, clamps to the nearest endpoint.
 */
export function getPopulationForYear(year: number): number {
  if (year <= minYear) return POPULATION_DATA[minYear]
  if (year >= maxYear) return POPULATION_DATA[maxYear]

  const lower = Math.floor(year)
  const upper = Math.ceil(year)

  if (lower === upper) {
    return POPULATION_DATA[lower] ?? POPULATION_DATA[maxYear]
  }

  const lowerPop = POPULATION_DATA[lower]
  const upperPop = POPULATION_DATA[upper]
  if (lowerPop == null || upperPop == null) {
    // Fallback: find nearest known year
    const nearest = years.reduce((best, y) =>
      Math.abs(y - year) < Math.abs(best - year) ? y : best
    )
    return POPULATION_DATA[nearest]!
  }

  return lerp(lowerPop, upperPop, year - lower)
}

export interface DebtPoint {
  period: string
  value: number
  unit: string | null
}

export interface PerCapitaPoint {
  period: string
  debtTotalMillions: number
  populationMillions: number
  perCapita: number
}

/**
 * Convert a debt-publica series (annual, value in millions of EUR)
 * into per-capita values using approximate population.
 *
 * Debt per capita = debt_total_eur / population
 */
export function computeDebtPerCapita(debtSeries: DebtPoint[]): PerCapitaPoint[] {
  return debtSeries
    .map((point) => {
      const year = Number(point.period.slice(0, 4))
      if (!Number.isFinite(year)) return null

      const populationMillions = getPopulationForYear(year)
      const debtTotalMillions = Number(point.value)
      if (!Number.isFinite(debtTotalMillions) || !Number.isFinite(populationMillions)) {
        return null
      }

      // debt in millions EUR, population in millions → per capita in EUR
      const perCapita = (debtTotalMillions * 1_000_000) / (populationMillions * 1_000_000)

      return {
        period: point.period,
        debtTotalMillions,
        populationMillions,
        perCapita,
      }
    })
    .filter(Boolean) as PerCapitaPoint[]
}

/**
 * Contextual facts derived from the per-capita series.
 */
export interface DebtContext {
  latestPerCapita: number
  latestPeriod: string
  latestDebtTotalMillions: number
  latestPopulationMillions: number
  tenYearsAgoPerCapita: number | null
  tenYearsAgoPeriod: string | null
  changePercent10Y: number | null
  changeAbsolute10Y: number | null
}

export function getDebtContext(perCapitaSeries: PerCapitaPoint[]): DebtContext | null {
  if (perCapitaSeries.length === 0) return null

  const sorted = [...perCapitaSeries].sort(
    (a, b) => a.period.localeCompare(b.period)
  )
  const latest = sorted[sorted.length - 1]

  // Find point closest to 10 years before latest, excluding the latest itself
  const latestYear = Number(latest.period.slice(0, 4))
  const targetYear = latestYear - 10
  let tenYearsAgo: PerCapitaPoint | null = null
  let minDiff = Infinity
  for (const point of sorted) {
    if (point.period === latest.period) continue
    const year = Number(point.period.slice(0, 4))
    const diff = Math.abs(year - targetYear)
    if (diff < minDiff) {
      minDiff = diff
      tenYearsAgo = point
    }
  }

  const changeAbsolute10Y =
    tenYearsAgo ? latest.perCapita - tenYearsAgo.perCapita : null
  const changePercent10Y =
    tenYearsAgo && tenYearsAgo.perCapita !== 0
      ? (changeAbsolute10Y! / tenYearsAgo.perCapita) * 100
      : null

  return {
    latestPerCapita: latest.perCapita,
    latestPeriod: latest.period,
    latestDebtTotalMillions: latest.debtTotalMillions,
    latestPopulationMillions: latest.populationMillions,
    tenYearsAgoPerCapita: tenYearsAgo?.perCapita ?? null,
    tenYearsAgoPeriod: tenYearsAgo?.period ?? null,
    changePercent10Y,
    changeAbsolute10Y,
  }
}

/**
 * How many months of average gross salary the debt per capita equals.
 */
export function monthsOfSalary(debtPerCapita: number, annualSalary: number): number {
  if (!Number.isFinite(annualSalary) || annualSalary === 0) return 0
  const monthlySalary = annualSalary / 12
  return debtPerCapita / monthlySalary
}
