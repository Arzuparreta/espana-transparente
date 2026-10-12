// What is bought through PCSP and how much competition each published award had.
// Budgets are project tender budgets excluding VAT: never awarded amounts or payments.

// Official CPV 2008 division labels (TED, cpv_2008_ver_2013.xlsx, column ES).
export const CPV_DIVISIONS: Record<string, string> = {
  "03": "Productos de la agricultura, ganadería, pesca, silvicultura y productos afines",
  "09": "Derivados del petróleo, combustibles, electricidad y otras fuentes de energía",
  "14": "Productos de la minería, de metales de base y productos afines",
  "15": "Alimentos, bebidas, tabaco y productos afines",
  "16": "Maquinaria agrícola",
  "18": "Prendas de vestir, calzado, artículos de viaje y accesorios",
  "19": "Piel y textiles, materiales de plástico y caucho",
  "22": "Impresos y productos relacionados",
  "24": "Productos químicos",
  "30": "Máquinas, equipo y artículos de oficina y de informática, excepto mobiliario y paquetes de software",
  "31": "Máquinas, aparatos, equipo y productos consumibles eléctricos; iluminación",
  "32": "Equipos de radio, televisión, comunicaciones y telecomunicaciones y equipos conexos",
  "33": "Equipamiento y artículos médicos, farmacéuticos y de higiene personal",
  "34": "Equipos de transporte y productos auxiliares",
  "35": "Equipo de seguridad, extinción de incendios, policía y defensa",
  "37": "Instrumentos musicales, artículos deportivos, juegos, juguetes, artículos de artesanía, materiales artísticos y accesorios",
  "38": "Equipo de laboratorio, óptico y de precisión (excepto gafas)",
  "39": "Mobiliario (incluido el de oficina), complementos de mobiliario, aparatos electrodomésticos (excluida la iluminación) y productos de limpieza",
  "41": "Agua recogida y depurada",
  "42": "Maquinaria industrial",
  "43": "Maquinaria para la minería y la explotación de canteras y equipo de construcción",
  "44": "Estructuras y materiales de construcción; productos auxiliares para la construcción (excepto aparatos eléctricos)",
  "45": "Trabajos de construcción",
  "48": "Paquetes de software y sistemas de información",
  "50": "Servicios de reparación y mantenimiento",
  "51": "Servicios de instalación (excepto software)",
  "55": "Servicios comerciales al por menor de hostelería y restauración",
  "60": "Servicios de transporte (excluido el transporte de residuos)",
  "63": "Servicios de transporte complementarios y auxiliares; servicios de agencias de viajes",
  "64": "Servicios de correos y telecomunicaciones",
  "65": "Servicios públicos",
  "66": "Servicios financieros y de seguros",
  "70": "Servicios inmobiliarios",
  "71": "Servicios de arquitectura, construcción, ingeniería e inspección",
  "72": "Servicios TI: consultoría, desarrollo de software, Internet y apoyo",
  "73": "Servicios de investigación y desarrollo y servicios de consultoría conexos",
  "75": "Servicios de administración pública, defensa y servicios de seguridad social",
  "76": "Servicios relacionados con la industria del gas y del petróleo",
  "77": "Servicios agrícolas, forestales, hortícolas, acuícolas y apícolas",
  "79": "Servicios a empresas: legislación, mercadotecnia, asesoría, selección de personal, imprenta y seguridad",
  "80": "Servicios de enseñanza y formación",
  "85": "Servicios de salud y asistencia social",
  "90": "Servicios de alcantarillado, basura, limpieza y medio ambiente",
  "92": "Servicios de esparcimiento, culturales y deportivos",
  "98": "Otros servicios comunitarios, sociales o personales",
}

export const PURCHASE_LEVELS = {
  state: "Administración General del Estado",
  autonomic: "Administración autonómica",
  municipal: "Administración local",
  unknown: "Nivel no identificado",
} as const
export type PurchaseLevel = keyof typeof PURCHASE_LEVELS

export type PurchaseRow = {
  award_year: number
  administration_level: PurchaseLevel
  cpv_division: string
  expedientes: number
  expedientes_verified: number
  budget_eur: number | string
  budget_missing: number
  results: number
  results_legacy: number
  results_one_offer: number
  results_two_to_four: number
  results_five_plus: number
  results_offers_unknown: number
}

export type PurchaseCoverage = {
  refreshed_at: string
  source_rows: number
  annulled_excluded: number
  superseded_legacy_excluded: number
  without_award_evidence: number
  invalid_award_date: number
  latest_award_date: string | null
  years: number[]
}

export type PurchaseDivision = {
  division: string
  label: string
  expedientes: number
  budget: number
  results: number
  oneOffer: number
  withOffers: number
}

export type PurchaseSummary = {
  year: number
  level: PurchaseLevel | null
  partialYear: boolean
  expedientes: number
  verified: number
  budget: number
  budgetMissing: number
  results: number
  legacyResults: number
  oneOffer: number
  twoToFour: number
  fivePlus: number
  offersUnknown: number
  divisions: PurchaseDivision[]
}

const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value)

export function selectPurchaseYear(coverage: PurchaseCoverage | null, requested?: string | string[], now = new Date()) {
  if (!coverage || coverage.years.length === 0) return null
  const raw = first(requested)
  if (raw !== undefined && raw !== "") {
    const year = Number(raw)
    return Number.isInteger(year) && coverage.years.includes(year) ? year : null
  }
  // Default to the latest complete year; the current one is still accumulating awards.
  const complete = coverage.years.filter((year) => year < now.getUTCFullYear())
  return complete.length ? Math.max(...complete) : Math.max(...coverage.years)
}

export function selectPurchaseLevel(requested?: string | string[]): PurchaseLevel | null | undefined {
  const raw = first(requested)
  if (raw === undefined || raw === "" || raw === "all") return null
  return Object.hasOwn(PURCHASE_LEVELS, raw) ? (raw as PurchaseLevel) : undefined
}

export const divisionLabel = (division: string) =>
  division === "none" ? "Sin código CPV publicado" : CPV_DIVISIONS[division] ?? `División CPV ${division}`

export function summarizePurchases(rows: PurchaseRow[], year: number, level: PurchaseLevel | null, now = new Date()): PurchaseSummary {
  const selected = rows.filter((row) => row.award_year === year && (level === null || row.administration_level === level))
  const divisions = new Map<string, PurchaseDivision>()
  const summary: PurchaseSummary = {
    year, level,
    partialYear: year >= now.getUTCFullYear(),
    expedientes: 0, verified: 0, budget: 0, budgetMissing: 0, results: 0, legacyResults: 0,
    oneOffer: 0, twoToFour: 0, fivePlus: 0, offersUnknown: 0, divisions: [],
  }
  for (const row of selected) {
    const budget = Number(row.budget_eur)
    summary.expedientes += row.expedientes
    summary.verified += row.expedientes_verified
    summary.budget += budget
    summary.budgetMissing += row.budget_missing
    summary.results += row.results
    summary.legacyResults += row.results_legacy
    summary.oneOffer += row.results_one_offer
    summary.twoToFour += row.results_two_to_four
    summary.fivePlus += row.results_five_plus
    summary.offersUnknown += row.results_offers_unknown
    const division = divisions.get(row.cpv_division) ?? {
      division: row.cpv_division, label: divisionLabel(row.cpv_division),
      expedientes: 0, budget: 0, results: 0, oneOffer: 0, withOffers: 0,
    }
    division.expedientes += row.expedientes
    division.budget += budget
    division.results += row.results
    division.oneOffer += row.results_one_offer
    division.withOffers += row.results - row.results_offers_unknown
    divisions.set(row.cpv_division, division)
  }
  summary.divisions = [...divisions.values()].sort((a, b) => b.budget - a.budget || b.expedientes - a.expedientes || a.division.localeCompare(b.division))
  return summary
}

export function validatePurchaseCoverage(value: unknown): PurchaseCoverage | null {
  if (!value || typeof value !== "object") return null
  const row = value as PurchaseCoverage
  if (!Array.isArray(row.years) || !row.years.every((year) => Number.isInteger(year))) return null
  if (typeof row.refreshed_at !== "string" || !Number.isInteger(row.source_rows)) return null
  return row
}

export const share = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : "sin dato"
