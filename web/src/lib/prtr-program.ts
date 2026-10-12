export const DUS_PROGRAM_URL = "https://sede.idae.gob.es/node/82"
export const DUS_LIST_URL =
  "https://tramitador.idae.gob.es/egovOV-web/app/listadoFavorable-flow?codProcedimiento=D5000"
export interface DusProject {
  id: string
  beneficiary: string
  project: string | null
  municipality: string | null
  province: string | null
  territory: string
  last_resolution: string
  grant_cents: number | null
}
export interface DusSnapshot {
  version: string
  instrument: string
  financing: string
  phase: string
  program: string
  program_url: string
  list_url: string
  retrieved_at: string
  sha256: Record<string, string>
  budget_cents: number
  territories: { code: string; label: string; budget_cents: number }[]
  summary: {
    records: number
    known_grant_cents: number
    unknown_amounts: number
    zero_amounts: number
    unknown_projects: number
  }
  rows: DusProject[]
}
const cents = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
export function summarizeDus(rows: DusProject[]) {
  return {
    records: rows.length,
    known_grant_cents: rows.reduce((sum, r) => sum + (r.grant_cents ?? 0), 0),
    unknown_amounts: rows.filter((r) => r.grant_cents === null).length,
    zero_amounts: rows.filter((r) => r.grant_cents === 0).length,
    unknown_projects: rows.filter((r) => r.project === null).length,
  }
}
export function validateDusSnapshot(value: unknown): DusSnapshot | null {
  if (!value || typeof value !== "object") return null
  const s = value as DusSnapshot
  if (
    s.version !== "idae-dus5000-v1" ||
    s.program !== "DUS5000" ||
    s.instrument !== "MRR/PRTR" ||
    s.financing !== "grant" ||
    s.phase !== "last-published-grant" ||
    s.program_url !== DUS_PROGRAM_URL ||
    s.list_url !== DUS_LIST_URL ||
    !Number.isFinite(Date.parse(s.retrieved_at)) ||
    !["programme", "list"].every((k) =>
      /^[a-f0-9]{64}$/.test(s.sha256?.[k] ?? ""),
    ) ||
    s.budget_cents !== 67500000000 ||
    !Array.isArray(s.territories) ||
    s.territories.length !== 17 ||
    !Array.isArray(s.rows) ||
    s.rows.length < 1000 ||
    s.rows.length > 5000
  )
    return null
  if (
    s.territories.some(
      (t, i) =>
        !t ||
        t.code !== String(i + 1).padStart(2, "0") ||
        typeof t.label !== "string" ||
        !t.label.trim() ||
        !cents(t.budget_cents),
    ) ||
    s.territories.reduce((sum, t) => sum + t.budget_cents, 0) !== s.budget_cents
  )
    return null
  const seen = new Set<string>()
  for (const r of s.rows) {
    if (
      !r ||
      !/^PR-D5000-20(?:21|22)-\d{6}[A-Z]?$/.test(r.id) ||
      seen.has(r.id) ||
      typeof r.beneficiary !== "string" ||
      !r.beneficiary.trim() ||
      !s.territories.some((t) => t.code === r.territory) ||
      !date(r.last_resolution) ||
      r.last_resolution < "2021-01-01" ||
      r.last_resolution > s.retrieved_at.slice(0, 10) ||
      ![r.project, r.municipality, r.province].every(
        (v) => v === null || (typeof v === "string" && v.trim().length > 0),
      ) ||
      (r.grant_cents !== null && !cents(r.grant_cents))
    )
      return null
    seen.add(r.id)
  }
  const sum = summarizeDus(s.rows)
  if (
    !Number.isSafeInteger(sum.known_grant_cents) ||
    !s.summary ||
    Object.keys(sum).some(
      (k) => sum[k as keyof typeof sum] !== s.summary[k as keyof typeof sum],
    )
  )
    return null
  return s
}
export function selectDusProjects(
  s: DusSnapshot,
  territory?: string | string[],
  query?: string | string[],
) {
  if (
    territory !== undefined &&
    (typeof territory !== "string" ||
      (territory !== "" && !s.territories.some((t) => t.code === territory)))
  )
    return null
  if (query !== undefined && (typeof query !== "string" || query.length > 120))
    return null
  const normalize = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  const term = normalize(query?.trim() ?? "")
  return s.rows.filter(
    (r) =>
      (!territory || r.territory === territory) &&
      (!term ||
        normalize(
          [r.id, r.beneficiary, r.project, r.municipality, r.province]
            .filter(Boolean)
            .join(" "),
        ).includes(term)),
  )
}
export const dusEuro = (value: number | null) =>
  value === null
    ? "Importe no publicado"
    : (value / 100).toLocaleString("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
      })
