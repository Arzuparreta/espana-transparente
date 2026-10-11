import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import { FiscalSectors } from "./FiscalSectors"
import { sectorYears } from "@/lib/fiscal-sectors"
import { sectorRows } from "@/lib/fiscal-sector-fixtures"
vi.mock("next/navigation", () => ({
  usePathname: () => "/cuentas-por-subsector",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
const data = () => ({ ...sectorYears(sectorRows()), error: false })
it("shows all scopes, source, consolidation and same-year links", () => {
  const html = renderToStaticMarkup(<FiscalSectors data={data()} />)
  for (const text of [
    "S13",
    "S1311",
    "S1312",
    "S1313",
    "S1314",
    "No sumes",
    "no equivale a la variación",
    "gov_10a_main",
    'scope="row"',
    'name="year"',
    "desde=2024&amp;hasta=2024",
  ])
    expect(html).toContain(text)
})
it("keeps error, unavailable, rejected and zero distinct", () => {
  expect(
    renderToStaticMarkup(<FiscalSectors data={{ ...data(), error: true }} />),
  ).toContain('role="alert"')
  const absent = renderToStaticMarkup(
    <FiscalSectors data={data()} year="2025" />,
  )
  expect(absent).not.toContain("<table")
  expect(absent).toContain("year=2024")
  expect(
    renderToStaticMarkup(
      <FiscalSectors
        data={{ years: [], rejectedYears: [2024], error: false }}
      />,
    ),
  ).toContain("Ejercicios excluidos")
  const rows = sectorRows()
  rows.forEach((r) => (r.value = 0))
  expect(
    renderToStaticMarkup(
      <FiscalSectors data={{ ...sectorYears(rows), error: false }} />,
    ),
  ).toContain("0 €")
})
