export const MRR_ORIGINAL = "https://www.boe.es/diario_boe/xml.php?id=BOE-A-2024-13820"
export const MRR_AMENDMENT = "https://www.boe.es/diario_boe/xml.php?id=BOE-A-2026-977"
export const AIREF_METHOD = "https://www.airef.es/wp-content/uploads/2024/04/PRTR/Metodologia-del-Observatorio-PRTR.-AIReF.pdf"
export const MRR_INSTRUMENTS = [
  "Líneas de préstamos ICO de mediación con intermediarios financieros.",
  "Financiación directa de ICO.",
  "Adquisición de bonos y otros títulos de deuda emitidos en mercados organizados.",
  "Inversiones en capital y cuasi-capital.",
]
interface Source { identifier: string; title: string; published: string; xml_url: string; sha256: string }
export interface MrrSnapshot {
  version: string; scope: string; signed: string; retrieved_at: string
  sources: { original: Source; amendment: Source }
  stage: string; effectiveness: string; instruments: string[]
  signatories: { name: string; role: string }[]
  facilities: { id: string; label: string; account: string; annualities: { year: number; cents: number }[]; total_cents: number }[]
}
export function mrrSnapshot(value: unknown): MrrSnapshot | null {
  if (!value || typeof value !== "object") return null
  const s = value as MrrSnapshot
  if (s.version !== "mrr-instruments-2026-v1" || s.scope !== "ico-2026" || s.signed !== "2025-12-31" || !Number.isFinite(Date.parse(s.retrieved_at)) || s.stage !== "commitments-to-ico" || s.effectiveness !== "registration-not-verified") return null
  for (const [key, identifier, published, url] of [
    ["original", "BOE-A-2024-13820", "2024-07-05", MRR_ORIGINAL],
    ["amendment", "BOE-A-2026-977", "2026-01-16", MRR_AMENDMENT],
  ] as const) {
    const source = s.sources?.[key]
    if (!source || source.identifier !== identifier || source.published !== published || source.xml_url !== url || typeof source.title !== "string" || !source.title.trim() || !/^[a-f0-9]{64}$/.test(source.sha256)) return null
  }
  if (!Array.isArray(s.instruments) || s.instruments.length !== 4 || s.instruments.some((v, i) => v !== MRR_INSTRUMENTS[i])) return null
  if (!Array.isArray(s.signatories) || s.signatories.length !== 2 || s.signatories[0]?.name !== "Israel Arroyo Martínez" || s.signatories[0]?.role !== "Secretario de Estado de Economía y Apoyo a la Empresa" || s.signatories[1]?.name !== "Manuel Illueca Muñoz" || s.signatories[1]?.role !== "Representante de ICO y AXIS") return null
  if (!Array.isArray(s.facilities) || s.facilities.length !== 2) return null
  const identities = [["ico-verde", "ICO Verde", "27.50.45MF.831.10"], ["ico-empresas", "ICO Empresas y Emprendedores", "27.50.43MF.831.01"]]
  for (const [i, f] of s.facilities.entries()) {
    if (!f || f.id !== identities[i][0] || f.label !== identities[i][1] || f.account !== identities[i][2] || !Array.isArray(f.annualities) || f.annualities.length !== 3 || !Number.isSafeInteger(f.total_cents) || f.total_cents < 0) return null
    if (f.annualities.some((row, j) => !row || row.year !== 2024+j || !Number.isSafeInteger(row.cents) || row.cents < 0)) return null
    if (f.annualities.reduce((sum, row) => sum+row.cents, 0) !== f.total_cents) return null
  }
  return s
}
export function mrrYear(value?: string | string[]): number | null {
  if (value === undefined) return 2026
  return typeof value === "string" && ["2024", "2025", "2026"].includes(value) ? Number(value) : null
}
export const mrrEuro = (cents: number) => (cents/100).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })
