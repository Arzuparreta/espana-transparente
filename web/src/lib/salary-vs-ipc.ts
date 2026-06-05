/**
 * Pure helpers for the "salary vs IPC" calculator.
 *
 * Operates on the IPC general-index series (base 2025 = 100). For each year
 * we take the last available month as a proxy for that year's price level.
 * No political framing, just the official index. Factual labels only.
 */

export interface IpcYearPoint {
  year: string
  period: string
  value: number
}

export interface SalaryVsIpcResult {
  fromYear: string
  toYear: string
  /** Salary the user entered. */
  inputSalary: number
  /** 'monthly' or 'annual'. */
  inputFrequency: "monthly" | "annual"
  /** Normalized annual salary from the user's input. */
  annualSalary: number
  /** Equivalent annual salary in toYear euros to preserve purchasing power. */
  equivalentAnnual: number
  /** Equivalent monthly salary in toYear euros. */
  equivalentMonthly: number
  /** Accumulated inflation between fromYear and toYear, in %. */
  accumulatedInflationPct: number
  /** Equivalent annual inflation rate over the span, in % (null if < 1 year). */
  annualizedInflationPct: number | null
  /** If a current salary was provided: normalized annual current salary. */
  currentAnnual?: number
  /** Gap in annual terms: current - equivalent (negative = losing purchasing power). */
  gapAnnual?: number
  /** Gap as % of the equivalent salary. */
  gapPct?: number
  /** Current salary expressed in fromYear euros. */
  realValueOfCurrentSalary?: number
}

export interface IndexPoint {
  period: string
  value: number
}

function yearOf(period: string): string {
  return period.slice(0, 4)
}

function monthsBetween(fromPeriod: string, toPeriod: string): number {
  const [fy, fm] = fromPeriod.split("-").map(Number)
  const [ty, tm] = toPeriod.split("-").map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/**
 * Extracts one IPC point per calendar year: the last available month of that year.
 * Returns ascending order by year.
 */
export function extractYearIpcPoints(series: IndexPoint[]): IpcYearPoint[] {
  const valid = series.filter(
    (p) =>
      Number.isFinite(p.value) &&
      p.value > 0 &&
      /^\d{4}-\d{2}$/.test(p.period),
  )

  const byYear = new Map<string, IndexPoint>()
  for (const point of valid) {
    const y = yearOf(point.period)
    const existing = byYear.get(y)
    if (!existing || point.period > existing.period) {
      byYear.set(y, point)
    }
  }

  return Array.from(byYear.entries())
    .map(([year, point]) => ({ year, period: point.period, value: point.value }))
    .sort((a, b) => (a.year < b.year ? -1 : a.year > b.year ? 1 : 0))
}

/**
 * Computes salary adjusted by IPC.
 *
 * @param salary       Amount entered by the user.
 * @param frequency    'monthly' or 'annual'.
 * @param fromYear     Reference year (e.g. "2015").
 * @param toYear       Target year (e.g. "2024"). Defaults to latest available.
 * @param currentSalary Optional current salary for gap calculation.
 * @param currentFrequency Optional frequency for currentSalary.
 * @param series       IPC general-index monthly series.
 */
export function computeSalaryVsIpc(
  salary: number,
  frequency: "monthly" | "annual",
  fromYear: string,
  toYear: string | undefined,
  series: IndexPoint[],
  currentSalary?: number,
  currentFrequency?: "monthly" | "annual",
): SalaryVsIpcResult | null {
  if (!Number.isFinite(salary) || salary <= 0) return null

  const yearPoints = extractYearIpcPoints(series)
  if (yearPoints.length < 2) return null

  const resolvedTo = toYear ?? yearPoints[yearPoints.length - 1].year
  const fromPoint = yearPoints.find((p) => p.year === fromYear)
  const toPoint = yearPoints.find((p) => p.year === resolvedTo)
  if (!fromPoint || !toPoint) return null

  const annualSalary = frequency === "monthly" ? salary * 12 : salary
  const ratio = toPoint.value / fromPoint.value
  const equivalentAnnual = annualSalary * ratio

  const months = monthsBetween(fromPoint.period, toPoint.period)
  const annualizedInflationPct =
    months >= 12 ? (Math.pow(ratio, 12 / months) - 1) * 100 : null

  const result: SalaryVsIpcResult = {
    fromYear,
    toYear: resolvedTo,
    inputSalary: salary,
    inputFrequency: frequency,
    annualSalary,
    equivalentAnnual,
    equivalentMonthly: equivalentAnnual / 12,
    accumulatedInflationPct: (ratio - 1) * 100,
    annualizedInflationPct,
  }

  if (currentSalary != null && Number.isFinite(currentSalary) && currentSalary > 0) {
    const currentAnnual =
      currentFrequency === "monthly" ? currentSalary * 12 : currentSalary
    result.currentAnnual = currentAnnual
    result.gapAnnual = currentAnnual - equivalentAnnual
    result.gapPct = equivalentAnnual !== 0 ? (result.gapAnnual / equivalentAnnual) * 100 : 0
    result.realValueOfCurrentSalary = currentAnnual / ratio
  }

  return result
}

/** Returns available years from the IPC series, sorted ascending. */
export function getAvailableYears(series: IndexPoint[]): string[] {
  return extractYearIpcPoints(series).map((p) => p.year)
}
