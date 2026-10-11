import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ detail: vi.fn(), share: vi.fn() }))
vi.mock("@/lib/data", () => ({
  getContractDetail: mocks.detail, getPartyAcronymMap: async () => ({}),
  getJudicialLinksForContract: async () => [], JUDICIAL_STATUS_LABEL: {},
}))
vi.mock("@/components/domain/ShareButton", () => ({ ShareButton: mocks.share }))
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("not found") }, usePathname: () => "/contratos/test",
  useRouter: () => ({ prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(),
}))
import Page from "./page"

it.each([[100, 100], [null, 100], [0, 0]])("shows adjudication with budget %s and award %s", async (amount, award_amount) => {
  mocks.detail.mockResolvedValue({ contract: { title: "Contrato", amount, award_amount, award_date: "2024-01-01", date: "2024-01-01" }, responsible: null })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "test" }) }))
  expect(html).toContain("Importe adjudicado sin IVA")
  expect(html).toContain("Fecha de adjudicación")
  expect(html).not.toContain("NaN")
  expect(html).not.toContain("Infinity")
})
it("does not share the tender budget as an adjudication", async () => {
  mocks.share.mockClear()
  mocks.detail.mockResolvedValue({ contract: { title: "Contrato", amount: 100, award_amount: null }, responsible: null })
  renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "test" }) }))
  const text = mocks.share.mock.calls[0][0].text
  expect(text).toContain("presupuesto de licitación")
  expect(text).not.toContain("adjudicó")
})
