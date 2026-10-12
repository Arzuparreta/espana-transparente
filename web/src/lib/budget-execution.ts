export const EXECUTION_SOURCE =
  "https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadPublica/CPE/EjecucionPresupuestaria/Paginas/imejecucionpresupuesto2025.aspx"
export const CHAPTERS = {
  "1": "Gastos de personal",
  "2": "Bienes y servicios",
  "3": "Gastos financieros",
  "4": "Transferencias corrientes",
  "5": "Fondo de contingencia y otros imprevistos",
  "6": "Inversiones reales",
  "7": "Transferencias de capital",
  "8": "Activos financieros",
  "9": "Pasivos financieros",
  NF: "Operaciones no financieras (1–7)",
  FIN: "Operaciones financieras (8–9)",
  TOTAL: "Total presupuestario (1–9)",
} as const
export type Chapter = keyof typeof CHAPTERS
export const EXECUTION_FIELDS = [
  "credit",
  "committed",
  "obligations",
  "payments",
] as const
export type ExecutionValues = Record<
  (typeof EXECUTION_FIELDS)[number],
  number | null
>
export type ExecutionObservation = Record<
  (typeof EXECUTION_FIELDS)[number],
  number | string | null
> & {
  scope: string
  period: string
  chapter: string
  unit: string
  raw_data: Record<string, unknown> | null
}
export interface ExecutionPeriod {
  period: string
  rows: Record<Chapter, ExecutionValues>
  lastChecked: string | null
  sourceUrl: string
}
export function executionPeriods(observations: ExecutionObservation[]) {
  const grouped = new Map<string, ExecutionObservation[]>()
  for (const row of observations)
    grouped.set(row.period, [...(grouped.get(row.period) ?? []), row])
  const periods: ExecutionPeriod[] = [],
    rejectedPeriods: string[] = []
  for (const [period, group] of grouped) {
    const rows = {} as ExecutionPeriod["rows"]
    const hashes = new Set(group.map((r) => r.raw_data?.workbook_sha256))
    const invalid =
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) ||
      group.length !== 12 ||
      hashes.size !== 1 ||
      group.some((row) => {
        const meta = row.raw_data
        if (
          !Object.hasOwn(CHAPTERS, row.chapter) ||
          Object.hasOwn(rows, row.chapter) ||
          row.scope !== "ES_STATE_BUDGET" ||
          row.unit !== "MILES_EUR" ||
          meta?.unit !== "MILES_EUR" ||
          meta?.sheet !== "GTOS 004" ||
          meta?.payment_basis !== "current_budget" ||
          meta?.period !== period ||
          meta?.mapping_version !== "igae-current-chapters-v1" ||
          typeof meta?.workbook_sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(meta.workbook_sha256) ||
          typeof meta?.source_url !== "string" ||
          !meta.source_url.startsWith("https://www.igae.pap.hacienda.gob.es/")
        )
          return true
        const values = {} as ExecutionValues
        for (const field of EXECUTION_FIELDS) {
          const raw = row[field]
          if (
            raw !== null &&
            ((typeof raw !== "number" && typeof raw !== "string") ||
              (typeof raw === "string" && !raw.trim()) ||
              !Number.isFinite(Number(raw)) ||
              Number(raw) < 0)
          )
            return true
          values[field] = raw === null ? null : Number(raw)
        }
        rows[row.chapter as Chapter] = values
        return false
      })
    const reconciled =
      !invalid &&
      (
        [
          ["NF", "1234567"],
          ["FIN", "89"],
          ["TOTAL", ["NF", "FIN"]],
        ] as [Chapter, string | Chapter[]][]
      ).every(([total, parts]) =>
        EXECUTION_FIELDS.every(
          (field) =>
            rows[total][field] !== null &&
            Math.abs(
              Array.from(parts).reduce(
                (sum, chapter) => sum + (rows[chapter as Chapter][field] ?? 0),
                0,
              ) - rows[total][field]!,
            ) <= 1,
        ),
      )
    if (!reconciled) {
      rejectedPeriods.push(period)
      continue
    }
    const checked = group
      .map((r) => r.raw_data?.retrieved_at)
      .filter(
        (v): v is string =>
          typeof v === "string" && Number.isFinite(Date.parse(v)),
      )
      .sort()
    periods.push({
      period,
      rows,
      lastChecked: checked.length === 12 ? checked[0] : null,
      sourceUrl: group[0].raw_data!.source_url as string,
    })
  }
  return {
    periods: periods.sort((a, b) => a.period.localeCompare(b.period)),
    rejectedPeriods: rejectedPeriods.sort(),
  }
}
export function selectExecutionPeriod(
  periods: ExecutionPeriod[],
  requested?: string | string[],
) {
  return requested === undefined
    ? periods.at(-1)
    : typeof requested === "string"
      ? periods.find((r) => r.period === requested)
      : undefined
}
export function executionRatio(
  numerator: number | null,
  denominator: number | null,
) {
  return numerator === null || denominator === null || denominator <= 0
    ? null
    : (100 * numerator) / denominator
}
