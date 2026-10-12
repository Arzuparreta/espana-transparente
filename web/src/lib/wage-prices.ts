// Did the average wage grow faster than prices? EAES annual mean gross wage against
// the change in the annual average of the CPI index, same calendar year.

export type IndicatorPoint = { indicator_code: string; period: string; value: number | string }

export type PurchasingPowerYear = {
  year: number
  wage: number
  wageChange: number
  priceChange: number
  realChange: number
}

export type PurchasingPower = {
  baseYear: number
  years: PurchasingPowerYear[]
}

export type PurchasingPowerSelection = PurchasingPowerYear & {
  cumulativeWage: number
  cumulativePrice: number
  cumulativeReal: number
}

export function purchasingPower(rows: IndicatorPoint[]): PurchasingPower | null {
  const wages = new Map<number, number>()
  const months = new Map<number, number[]>()
  for (const row of rows) {
    const value = Number(row.value)
    if (!Number.isFinite(value) || value <= 0) continue
    if (row.indicator_code === "SALARIO_MEDIO") {
      const match = /^(\d{4})-A$/.exec(row.period)
      if (match) wages.set(Number(match[1]), value)
    } else if (row.indicator_code === "IPC") {
      const match = /^(\d{4})-(\d{2})$/.exec(row.period)
      if (match) months.set(Number(match[1]), [...(months.get(Number(match[1])) ?? []), value])
    }
  }
  // Only complete calendar years: a partial year average is not the published annual mean.
  const priceAverage = new Map<number, number>()
  for (const [year, values] of months) {
    if (values.length === 12) priceAverage.set(year, values.reduce((sum, v) => sum + v, 0) / 12)
  }
  const usable = [...wages.keys()].filter((year) => priceAverage.has(year)).sort((a, b) => a - b)
  const years: PurchasingPowerYear[] = []
  for (const year of usable) {
    const previous = year - 1
    if (!wages.has(previous) || !priceAverage.has(previous)) continue
    const wageChange = wages.get(year)! / wages.get(previous)! - 1
    const priceChange = priceAverage.get(year)! / priceAverage.get(previous)! - 1
    years.push({ year, wage: wages.get(year)!, wageChange, priceChange, realChange: (1 + wageChange) / (1 + priceChange) - 1 })
  }
  // Cumulative changes chain year to year: keep only the latest consecutive run.
  let start = years.length - 1
  while (start > 0 && years[start - 1].year === years[start].year - 1) start--
  const run = years.slice(start)
  if (run.length === 0) return null
  return { baseYear: run[0].year - 1, years: run }
}

export function selectPurchasingPowerYear(data: PurchasingPower | null, requested?: string | string[]): PurchasingPowerSelection | null | undefined {
  if (!data) return null
  const raw = Array.isArray(requested) ? requested[0] : requested
  const year = raw === undefined || raw === "" ? data.years.at(-1)!.year : Number(raw)
  const index = data.years.findIndex((row) => row.year === year)
  if (index < 0) return undefined
  const chain = data.years.slice(0, index + 1)
  const cumulativeWage = chain.reduce((acc, row) => acc * (1 + row.wageChange), 1) - 1
  const cumulativePrice = chain.reduce((acc, row) => acc * (1 + row.priceChange), 1) - 1
  return { ...data.years[index], cumulativeWage, cumulativePrice, cumulativeReal: (1 + cumulativeWage) / (1 + cumulativePrice) - 1 }
}

export const signedPercent = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value * 100).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
