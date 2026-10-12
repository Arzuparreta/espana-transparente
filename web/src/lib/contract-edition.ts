export interface ContractMoney { value: string | null; currency: string | null }
export interface ContractProject { name: string | null; cpv_codes: string[]; budget_excluding_tax: ContractMoney; budget_including_tax: ContractMoney }
export interface ContractResult { result_code: string | null; lot_id: string | null; award_date: string | null; received_tenders: number | null; contractor: string | null; contract_number: string | null; award_excluding_tax: ContractMoney; award_including_tax: ContractMoney }
export interface ContractEdition { version: string; source_id: string; source_updated: string; folder_number: string | null; stage: string; project: ContractProject; lots: { id: string | null; project: ContractProject }[]; results: ContractResult[] }
const nullableText = (value: unknown) => value === null || typeof value === "string"
function validMoney(value: ContractMoney | undefined) {
  return !!value && (value.value === null || typeof value.value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.value) && Number.isFinite(Number(value.value)) && Math.abs(Number(value.value)) < 1e13) && (value.currency === null || typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency))
}
function validProject(value: ContractProject | undefined) {
  return !!value && nullableText(value.name) && Array.isArray(value.cpv_codes) && value.cpv_codes.every(code => typeof code === "string" && !!code.trim()) && validMoney(value.budget_excluding_tax) && validMoney(value.budget_including_tax)
}
export function contractEdition(value: unknown, sourceId?: string | null): ContractEdition | null {
  if (!value || typeof value !== "object") return null
  const e = value as ContractEdition
  if (e.version !== "pcsp-published-edition-v1" || !/^https:\/\/contrataciondelestado\.es\/sindicacion\/licitacionesPerfilContratante\/[1-9]\d{0,19}$/.test(e.source_id) || sourceId !== undefined && e.source_id !== sourceId || !Number.isFinite(Date.parse(e.source_updated)) || e.stage !== "published-budget-and-tender-results-not-payments" || !nullableText(e.folder_number) || !validProject(e.project) || !Array.isArray(e.lots) || e.lots.length > 2000 || !Array.isArray(e.results) || e.results.length > 2000) return null
  if (e.lots.some(lot => !lot || !nullableText(lot.id) || !validProject(lot.project))) return null
  if (e.results.some(r => !r || ![r.result_code, r.lot_id, r.award_date, r.contractor, r.contract_number].every(nullableText) || r.received_tenders !== null && (!Number.isSafeInteger(r.received_tenders) || r.received_tenders < 0) || !validMoney(r.award_excluding_tax) || !validMoney(r.award_including_tax))) return null
  return e
}
export function contractAmount(amount: number | null, currency: string | null | undefined) {
  if (amount === null) return "No publicado"
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return `${amount.toLocaleString("es-ES", { maximumFractionDigits: 2 })} · moneda no acreditada`
  return amount.toLocaleString("es-ES", { style: "currency", currency, maximumFractionDigits: 2 })
}
export function publishedMoney(money: ContractMoney) {
  if (money.value === null) return "No publicado"
  // Format source decimal digits as text; preserve precision rather than round to cents.
  const [whole, fraction] = money.value.split(".")
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${grouped}${fraction === undefined ? "" : `,${fraction}`} · ${money.currency ?? "moneda no acreditada"}`
}
export function comparableAward(e: ContractEdition | null) {
  return !!e && e.lots.length === 0 && e.results.length === 1 && e.results[0].lot_id === null && !!e.project.budget_excluding_tax.currency && e.project.budget_excluding_tax.currency === e.results[0].award_excluding_tax.currency
}
