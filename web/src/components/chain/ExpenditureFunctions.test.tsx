import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { cofogYears } from "@/lib/cofog"
import { rows } from "@/lib/cofog-fixtures"
import { ExpenditureFunctions } from "./ExpenditureFunctions"
vi.mock("next/navigation", () => ({
  usePathname: () => "/gasto-por-funciones",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
function data(total = 100) {
  return { ...cofogYears(rows(total)), error: false }
}
it("publishes a sourced annual table with matching links and native keyboard controls", () => {
  const html = renderToStaticMarkup(<ExpenditureFunctions data={data()} />)
  expect(html).toContain('name="year"')
  expect(html).toContain('type="submit"')
  expect(html).toContain('scope="row"')
  expect(html).toContain("gov_10a_exp")
  expect(html).toContain("S13 · MIO_EUR")
  expect(html).toContain("GF10")
  expect(html).toContain("no son solo pensiones")
  expect(html).toContain("desde=2024&amp;hasta=2024")
})
it("does not substitute 2024 for the requested 2025", () => {
  const html = renderToStaticMarkup(
    <ExpenditureFunctions data={data()} year="2025" />,
  )
  expect(html).toContain("ejercicio solicitado")
  expect(html).toContain('href="/gasto-por-funciones?year=2024"')
  expect(html).not.toContain("<table")
})
it("keeps errors, unavailable and zero states distinct", () => {
  expect(
    renderToStaticMarkup(
      <ExpenditureFunctions
        data={{ years: [], rejectedYears: [], error: true }}
      />,
    ),
  ).toContain('role="alert"')
  expect(
    renderToStaticMarkup(<ExpenditureFunctions data={data(0)} />),
  ).toContain("No se calcula un reparto")
  expect(
    renderToStaticMarkup(
      <ExpenditureFunctions
        data={{ years: [], rejectedYears: [2024], error: false }}
      />,
    ),
  ).toContain("Repartos excluidos")
})
