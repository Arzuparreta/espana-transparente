export const FISCAL_SERIES = {
  INGRESOS_PUBLICOS: "Ingresos públicos",
  GASTO_PUBLICO: "Gasto público realizado",
  SALDO_PUBLICO: "Saldo: superávit (+), déficit (−)",
  DEUDA_PUBLICA: "Deuda pública Maastricht",
  INTERESES_PUBLICOS: "Intereses",
  IMPUESTOS_PUBLICOS: "Impuestos antes del ajuste por incobrables",
  COTIZACIONES_SOCIALES: "Cotizaciones sociales netas",
} as const
export type FiscalCode = keyof typeof FISCAL_SERIES
export interface FiscalObservation {
  indicator_code: string
  period: string
  value: number | null
  unit: string | null
  raw_data: Record<string, unknown> | null
}
export interface FiscalYear {
  year: number
  values: Record<FiscalCode, number>
  provisional: boolean
}
export function fiscalYears(rows: FiscalObservation[]): FiscalYear[] {
  const years = new Map<number, Partial<Record<FiscalCode, number>>>()
  const provisional = new Set<number>()
  for (const row of rows) {
    if (
      !(row.indicator_code in FISCAL_SERIES) ||
      !/^\d{4}$/.test(row.period) ||
      row.value == null ||
      row.unit !== "millones EUR"
    )
      continue
    const value = Number(row.value),
      year = Number(row.period)
    if (!Number.isFinite(value) || year < 2016) continue
    const values = years.get(year) ?? {}
    values[row.indicator_code as FiscalCode] = value
    years.set(year, values)
    if (
      Array.isArray(row.raw_data?.flags) &&
      row.raw_data.flags.some((flag) => String(flag).includes("p"))
    )
      provisional.add(year)
  }
  return [...years]
    .filter(([, values]) =>
      Object.keys(FISCAL_SERIES).every(
        (code) => values[code as FiscalCode] != null,
      ),
    )
    .filter(
      ([, v]) =>
        Math.abs(v.INGRESOS_PUBLICOS! - v.GASTO_PUBLICO! - v.SALDO_PUBLICO!) <=
        0.3,
    )
    .map(([year, values]) => ({
      year,
      values: values as Record<FiscalCode, number>,
      provisional: provisional.has(year),
    }))
    .sort((a, b) => a.year - b.year)
}
export function selectFiscalRange(
  years: FiscalYear[],
  from?: string,
  to?: string,
) {
  const first = years[0]?.year ?? 2016,
    last = years.at(-1)?.year ?? first
  const parse = (value: string | undefined, fallback: number) =>
    value && /^\d{4}$/.test(value)
      ? Math.max(first, Math.min(last, Number(value)))
      : fallback
  const start = parse(from, first),
    end = parse(to, last)
  return {
    from: Math.min(start, end),
    to: Math.max(start, end),
    years: years.filter(
      (y) => y.year >= Math.min(start, end) && y.year <= Math.max(start, end),
    ),
  }
}
export function fiscalNumber(value: number) {
  return value.toLocaleString("es-ES", { maximumFractionDigits: 1 })
}
