import { expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { contractAmount, contractEdition, comparableAward, publishedMoney, type ContractEdition } from "./contract-edition"
import { PublishedContractEdition } from "@/components/contratos/ContractEdition"
vi.mock("next/navigation", () => ({ usePathname: () => "/contratos/test", useRouter: () => ({ prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
function fixture(): ContractEdition {
  return { version: "pcsp-published-edition-v1", source_id: "https://contrataciondelestado.es/sindicacion/licitacionesPerfilContratante/123", source_updated: "2026-10-12T12:00:00Z", folder_number: "EXP-1", stage: "published-budget-and-tender-results-not-payments", project: { name: "Proyecto", cpv_codes: ["72000000"], budget_excluding_tax: { value: "100.0000", currency: "EUR" }, budget_including_tax: { value: null, currency: null } }, lots: [], results: [{ result_code: "8", lot_id: null, award_date: "2026-10-01", received_tenders: 0, contractor: "Entidad de prueba", contract_number: "Contrato-1", award_excluding_tax: { value: "90.1234", currency: "EUR" }, award_including_tax: { value: null, currency: null } }] }
}
it("preserves original source precision, zero and unknown currency", () => {
  expect(publishedMoney({ value: "1234.5678", currency: "USD" })).toBe("1.234,5678 · USD")
  expect(publishedMoney({ value: "0.0000", currency: null })).toContain("0,0000 · moneda no acreditada")
  expect(publishedMoney({ value: null, currency: "EUR" })).toBe("No publicado")
  expect(contractAmount(100, null)).toContain("moneda no acreditada")
  expect(contractAmount(100, "USD")).toContain("US$")
})
it("does not compare an individual lot, unknown currency or multiple results against whole-project budget", () => {
  const e = fixture(); expect(comparableAward(e)).toBe(true)
  e.results[0].lot_id = "1"; expect(comparableAward(e)).toBe(false)
  e.results[0].lot_id = null; e.results[0].award_excluding_tax.currency = "USD"; expect(comparableAward(e)).toBe(false)
  e.results[0].award_excluding_tax.currency = "EUR"; e.results.push({ ...e.results[0] }); expect(comparableAward(e)).toBe(false)
  expect(comparableAward(null)).toBe(false)
})
it("renders every result without adding budgets or inferring unique bidders", () => {
  const e = fixture(); e.results.push({ ...e.results[0], lot_id: "2", received_tenders: null })
  const html = renderToStaticMarkup(<PublishedContractEdition edition={contractEdition(e)} />)
  for (const text of ["Resultado publicado 1", "Resultado publicado 2", "90,1234", "no se suman entre sí", "no publicadas", "licitadores únicos", "0"] ) expect(html).toContain(text)
  expect(renderToStaticMarkup(<PublishedContractEdition edition={null} />)).toContain("campos históricos")
})
it("rejects changed identity, unsafe decimals and malformed per-result fields", () => {
  expect(contractEdition(fixture(), "another-id")).toBeNull()
  const e = fixture(); e.results[0].received_tenders = -1; expect(contractEdition(e)).toBeNull()
  e.results[0].received_tenders = 1; e.results[0].award_excluding_tax.value = "NaN"; expect(contractEdition(e)).toBeNull()
  expect(contractEdition({})).toBeNull()
})
