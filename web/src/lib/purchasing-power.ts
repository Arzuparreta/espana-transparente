/**
 * Pure helpers for the purchasing-power calculator.
 *
 * Operates on the IPC general index series (base 2025 = 100) emitted by
 * etl/src/ine/indicadores.py under indicator_code "IPC". The math is the
 * standard CPI-ratio adjustment — no political framing, just the official
 * index. Factual labels only (see AGENTS.md).
 */

export interface IndexPoint {
  /** "YYYY-MM" */
  period: string
  /** IPC general index value (base 2025 = 100). */
  value: number
}

export interface PurchasingPowerResult {
  fromPeriod: string
  toPeriod: string
  /** Nominal amount the user entered, expressed in `fromPeriod` euros. */
  amount: number
  /** Euros needed in `toPeriod` to buy what `amount` bought in `fromPeriod`. */
  equivalent: number
  /** Accumulated inflation between the two periods, in %. */
  accumulatedInflationPct: number
  /** Equivalent annual inflation rate over the span, in % (null if span < 1 month). */
  annualizedInflationPct: number | null
  /**
   * Real value, in `toPeriod` euros, of holding `amount` nominal euros from
   * `fromPeriod` to `toPeriod` without any return (e.g. cash under the mattress).
   */
  realValueOfKeptMoney: number
  /** Purchasing power lost on that kept money, in euros. */
  purchasingPowerLost: number
}

/** Returns the available periods sorted ascending (oldest first). */
export function sortIndexAscending(series: IndexPoint[]): IndexPoint[] {
  return [...series]
    .filter((p) => Number.isFinite(p.value) && p.value > 0 && /^\d{4}-\d{2}$/.test(p.period))
    .sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
}

function monthsBetween(fromPeriod: string, toPeriod: string): number {
  const [fy, fm] = fromPeriod.split("-").map(Number)
  const [ty, tm] = toPeriod.split("-").map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/**
 * Adjusts `amount` (expressed in `fromPeriod` euros) to `toPeriod` euros using
 * the IPC general index. Returns null if either period is missing from the
 * series or the amount is not a finite, positive number.
 */
export function computePurchasingPower(
  series: IndexPoint[],
  amount: number,
  fromPeriod: string,
  toPeriod?: string,
): PurchasingPowerResult | null {
  if (!Number.isFinite(amount) || amount <= 0) return null

  const sorted = sortIndexAscending(series)
  if (sorted.length === 0) return null

  const resolvedTo = toPeriod ?? sorted[sorted.length - 1].period
  const fromPoint = sorted.find((p) => p.period === fromPeriod)
  const toPoint = sorted.find((p) => p.period === resolvedTo)
  if (!fromPoint || !toPoint) return null

  const ratio = toPoint.value / fromPoint.value
  const equivalent = amount * ratio
  const accumulatedInflationPct = (ratio - 1) * 100

  const months = monthsBetween(fromPeriod, resolvedTo)
  const annualizedInflationPct =
    months >= 1 ? (Math.pow(ratio, 12 / months) - 1) * 100 : null

  const realValueOfKeptMoney = amount / ratio
  const purchasingPowerLost = amount - realValueOfKeptMoney

  return {
    fromPeriod,
    toPeriod: resolvedTo,
    amount,
    equivalent,
    accumulatedInflationPct,
    annualizedInflationPct,
    realValueOfKeptMoney,
    purchasingPowerLost,
  }
}
