import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ page: vi.fn(), filtered: vi.fn() }))
vi.mock("@/lib/data", () => ({
  PAGE_SIZE: { contracts: 50 }, parsePage: () => 1,
  getContractPage: mocks.page, getContractPageFiltered: mocks.filtered,
  getEtlLastFinished: async () => null,
  getMoneyDatasetSummary: async () => ({ total: { total_rows: 99, latest_record_date: null } }),
}))
vi.mock("@/lib/data/organizations", () => ({
  getOrganizationFilterName: async () => null, getExplorationTerritoryLabels: async () => ({}),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/contratos", useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams("year=2024&ministry=Hacienda"),
}))
import Page from "./page"
beforeEach(() => {
  vi.clearAllMocks()
  mocks.page.mockResolvedValue({ contracts: [], total: 99 })
  mocks.filtered.mockResolvedValue({ contracts: [], total: 0 })
})
it("answers with the filtered count while identifying full-history source coverage", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ year: "2024", ministry: "Hacienda" }) }))
  expect(html).toContain("0</span> licitaciones en esta consulta")
  expect(html).toContain("Año 2024")
  expect(html).toContain("Histórico del portal · 99 licitaciones")
  expect(html).toContain("no fecha de adjudicación ni de pago")
  expect(html).not.toContain("Suma ·")
  expect(mocks.filtered).toHaveBeenCalledWith(1, "all", "Hacienda", null, null, 2024, null, null, "by", null, "all")
})
it("rejects partially numeric annual filters", async () => {
  await Page({ searchParams: Promise.resolve({ year: "2024oops" }) })
  expect(mocks.page).toHaveBeenCalled()
  expect(mocks.filtered).not.toHaveBeenCalled()
})
