export const WAITING_SOURCE =
  "https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/docs/LISTAS_PUBLICACION_Dic_2025_rectificado.pdf"
export const WAITING_INDEX =
  "https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/listaEspera.htm"
export const WAITING_CORRECTION =
  "https://www.sanidad.gob.es/estadEstudios/estadisticas/inforRecopilaciones/docs/Nota_Aclaratoria_Rectificacion_Dic_2025.pdf"
export interface WaitingRow {
  code: string
  label: string
  patients: number
  rate: number
  over_six_months: number
  over_six_share: number
  mean_days: number
}
export interface WaitingSnapshot {
  version: "sisle-surgery-2025-v1"
  cut: "2025-12-31"
  revision_date: string
  retrieved_at: string
  source_url: string
  index_url: string
  correction_url: string
  source_page: number
  denominator: string
  sha256: Record<string, string>
  rows: WaitingRow[]
}
export function validateWaitingSnapshot(
  value: unknown,
): WaitingSnapshot | null {
  if (!value || typeof value !== "object") return null
  const s = value as WaitingSnapshot
  if (
    s.version !== "sisle-surgery-2025-v1" ||
    s.cut !== "2025-12-31" ||
    s.source_url !== WAITING_SOURCE ||
    s.index_url !== WAITING_INDEX ||
    s.correction_url !== WAITING_CORRECTION ||
    s.source_page !== 8 ||
    s.denominator !== "health-card-population" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s.revision_date ?? "") ||
    s.revision_date < "2026-09-24" ||
    !Number.isFinite(Date.parse(s.revision_date)) ||
    !Number.isFinite(Date.parse(s.retrieved_at)) ||
    !["index", "report", "correction"].every((k) =>
      /^[a-f0-9]{64}$/.test(s.sha256?.[k] ?? ""),
    ) ||
    !Array.isArray(s.rows) ||
    s.rows.length !== 20
  )
    return null
  const expected = [
    ...Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, "0")),
    "ES",
  ]
  if (
    s.rows.some(
      (r, i) =>
        !r ||
        typeof r !== "object" ||
        r.code !== expected[i] ||
        typeof r.label !== "string" ||
        !r.label.trim() ||
        ![
          r.patients,
          r.rate,
          r.over_six_months,
          r.over_six_share,
          r.mean_days,
        ].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0) ||
        ![r.patients, r.over_six_months, r.mean_days].every(Number.isInteger) ||
        (r.patients === 0 && r.over_six_share !== 0) ||
        r.over_six_months > r.patients ||
        r.over_six_share > 100 ||
        (r.patients > 0 &&
          Math.abs((100 * r.over_six_months) / r.patients - r.over_six_share) >
            0.051),
    )
  )
    return null
  const total = s.rows.at(-1)!
  if (
    ["patients", "over_six_months"].some(
      (k) =>
        s.rows
          .slice(0, -1)
          .reduce(
            (sum, r) => sum + r[k as "patients" | "over_six_months"],
            0,
          ) !== total[k as "patients" | "over_six_months"],
    )
  )
    return null
  if (total.patients > 0 && Math.abs(s.rows.slice(0,-1).reduce((sum,r) => sum+r.patients*r.mean_days,0)/total.patients-total.mean_days) > 1) return null
  return s
}
export function selectWaitingRow(
  s: WaitingSnapshot,
  territory?: string | string[],
  cut?: string | string[],
) {
  if (cut !== undefined && cut !== s.cut) return undefined
  if (territory !== undefined && typeof territory !== "string") return undefined
  return s.rows.find((r) => r.code === (territory ?? "ES"))
}
