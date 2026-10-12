import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { ContractPurchaseAnswer } from "./ContractPurchaseAnswer"
import { coverage, row } from "@/lib/contract-purchases-fixture"

vi.mock("next/navigation", () => ({ usePathname: () => "/contratos", useRouter: () => ({ prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams() }))

const data = (over = {}) => ({ coverage, year: 2025, rows: [row({}), row({ cpv_division: "72", budget_eur: 5, results_one_offer: 0, results_five_plus: 1 })], error: false, ...over })

it("answers before the directory with measure, competition, limits and a shareable query", () => {
  const html = renderToStaticMarkup(<ContractPurchaseAnswer data={data()} level={null} />)
  for (const text of ["¿Qué se compra y con cuánta competencia?", "Trabajos de construcción", "No es importe adjudicado ni pagado",
    "Una sola oferta no prueba irregularidad", "contratos menores", "primer resultado", "award_year=2025", 'name="award_level"', "50 %"])
    expect(html).toContain(text)
  expect(html).not.toContain("award_level=")
})

it("keeps the level in the link and lists every division beyond the top", () => {
  const rows = Array.from({ length: 10 }, (_, i) => row({ cpv_division: String(30 + i), budget_eur: 100 - i }))
  const html = renderToStaticMarkup(<ContractPurchaseAnswer data={data({ rows })} level="state" />)
  expect(html).toContain("award_level=state")
  expect(html).toContain("Todas las divisiones CPV (10)")
})

it("separates failure, missing summary, invalid selection and empty selection", () => {
  expect(renderToStaticMarkup(<ContractPurchaseAnswer data={data({ error: true, coverage: null, year: null })} level={null} />)).toContain("no se presenta como cero")
  expect(renderToStaticMarkup(<ContractPurchaseAnswer data={data({ coverage: null, year: null })} level={null} />)).toContain("No equivale a ausencia")
  expect(renderToStaticMarkup(<ContractPurchaseAnswer data={data({ year: null })} level={null} />)).toContain("No se sustituye")
  expect(renderToStaticMarkup(<ContractPurchaseAnswer data={data()} level={undefined} />)).toContain("No se sustituye")
  expect(renderToStaticMarkup(<ContractPurchaseAnswer data={data({ rows: [] })} level={null} />)).toContain("No constan adjudicaciones")
})
