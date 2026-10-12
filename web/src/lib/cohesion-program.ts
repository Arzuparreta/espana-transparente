export const COHESION_DATASETS = ["99js-gm52", "gayr-92qh"] as const
export const IMPLEMENTATION_FIELDS = {
  eu_cents: "Contribución UE prevista",
  national_cents: "Cofinanciación nacional prevista",
  planned_cents: "Coste total previsto",
  selected_cents: "Coste de proyectos seleccionados",
  declared_cents: "Gasto elegible declarado",
} as const
export const PAYMENT_FIELDS = {
  eu_planned_cents: "Asignación neta UE",
  pre_financing_cents: "Prefinanciación neta",
  interim_cents: "Pagos intermedios netos",
  net_payments_cents: "Transferencias netas al Estado",
} as const
export interface CohesionPeriod {
  year: number
  title: string
  source_rows: number
  known: Record<string, number>
  missing: Record<string, number>
  ver?: string | null
  ir_last_version?: string | null
  reference_date?: string | null
}
export interface CohesionProgramme {
  cci: string
  implementation: CohesionPeriod[]
  payments: CohesionPeriod[]
}
export interface CohesionSnapshot {
  version: string
  scope: string
  retrieved_at: string
  sources: Record<
    string,
    { url: string; metadata_url: string; updated_at: string; sha256: string }
  >
  source_rows: Record<string, number>
  programmes: CohesionProgramme[]
}
export function validateCohesionSnapshot(
  value: unknown,
): CohesionSnapshot | null {
  if (!value || typeof value !== "object") return null
  const s = value as CohesionSnapshot
  if (
    s.version !== "cohesion-es-erdf-2014-v1" ||
    s.scope !== "ES_ERDF_2014_2020" ||
    !Number.isFinite(Date.parse(s.retrieved_at)) ||
    !Array.isArray(s.programmes) ||
    s.programmes.length < 1 ||
    s.programmes.length > 60
  )
    return null
  if (
    !COHESION_DATASETS.every((code) => {
      const src = s.sources?.[code]
      return (
        src?.url ===
          `https://cohesiondata.ec.europa.eu/resource/${code}.json?ms=ES&fund=ERDF&%24limit=5000` &&
        src.metadata_url ===
          `https://cohesiondata.ec.europa.eu/api/views/${code}.json` &&
        Number.isFinite(Date.parse(src.updated_at)) &&
        /^[a-f0-9]{64}$/.test(src.sha256) &&
        Number.isInteger(s.source_rows?.[code]) &&
        s.source_rows[code] > 0 &&
        s.source_rows[code] <= 5000
      )
    })
  )
    return null
  const ids = new Set<string>(),
    sourceTotals = [0, 0]
  for (const p of s.programmes) {
    if (!p || !/^2014ES16RF(?:OP|SM)\d{3}$/.test(p.cci) || ids.has(p.cci))
      return null
    ids.add(p.cci)
    for (const [i, periods] of [p.implementation, p.payments].entries()) {
      if (!Array.isArray(periods) || periods.length > 30) return null
      const years = new Set<number>(),
        fields =
          i === 0
            ? Object.keys(IMPLEMENTATION_FIELDS)
            : Object.keys(PAYMENT_FIELDS)
      for (const r of periods) {
        if (
          !r ||
          !Number.isInteger(r.year) ||
          r.year < 2014 ||
          r.year > Number(s.retrieved_at.slice(0, 4)) ||
          (i === 0 && r.year > 2023) ||
          years.has(r.year) ||
          typeof r.title !== "string" ||
          !r.title.trim() ||
          !Number.isInteger(r.source_rows) ||
          r.source_rows <= 0 ||
          !r.known ||
          !r.missing
        )
          return null
        years.add(r.year)
        sourceTotals[i] += r.source_rows
        if (
          fields.some(
            (k) =>
              !Number.isSafeInteger(r.known[k]) ||
              (i === 0 && r.known[k] < 0) ||
              !Number.isInteger(r.missing[k]) ||
              r.missing[k] < 0 ||
              r.missing[k] > r.source_rows,
          )
        )
          return null
        const sumFields =
          i === 0
            ? ["eu_cents", "national_cents", "planned_cents"]
            : ["pre_financing_cents", "interim_cents", "net_payments_cents"]
        if (
          sumFields.every((k) => r.missing[k] === 0) &&
          r.known[sumFields[0]] + r.known[sumFields[1]] !==
            r.known[sumFields[2]]
        )
          return null
        if (
          i === 0 &&
          (typeof r.ver !== "string" ||
            !r.ver ||
            (r.ir_last_version !== null &&
              typeof r.ir_last_version !== "string") ||
            (r.reference_date !== null &&
              (typeof r.reference_date !== "string" ||
                !Number.isFinite(Date.parse(r.reference_date)))))
        )
          return null
      }
    }
    if (!p.implementation.length && !p.payments.length) return null
  }
  if (sourceTotals.some((n, i) => n !== s.source_rows[COHESION_DATASETS[i]]))
    return null
  return s
}
export function cohesionYears(
  s: CohesionSnapshot,
  kind: "implementation" | "payments",
) {
  return [
    ...new Set(s.programmes.flatMap((p) => p[kind].map((r) => r.year))),
  ].sort((a, b) => a - b)
}
export function selectCohesionYear(years: number[], value?: string | string[]) {
  return value === undefined
    ? years.at(-1)
    : typeof value === "string" &&
        /^20\d{2}$/.test(value) &&
        years.includes(Number(value))
      ? Number(value)
      : undefined
}
export function cohesionAmount(p: CohesionPeriod, key: string) {
  if (p.missing[key] === p.source_rows) return `No publicado · faltan las ${p.source_rows} filas`
  const value = (p.known[key] / 100).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  })
  return p.missing[key] > 0
    ? `${value} conocidos · faltan ${p.missing[key]} de ${p.source_rows} filas`
    : value
}
export function cohesionHref(
  cci: string | undefined,
  implementationYear: number | undefined,
  paymentYear: number | undefined,
) {
  const params = new URLSearchParams()
  if (implementationYear !== undefined)
    params.set("implementationYear", String(implementationYear))
  if (paymentYear !== undefined) params.set("paymentYear", String(paymentYear))
  return `/fondos-ue/cohesion${cci ? `/${cci}` : ""}${params.size ? `?${params}` : ""}`
}
