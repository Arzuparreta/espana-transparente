import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"
import fixture from "@/lib/service-waiting.fixture.json"
const mocks = vi.hoisted(() => ({ waiting: vi.fn(), spending: vi.fn() }))
vi.mock("@/lib/data/service-waiting", () => ({
  getServiceWaiting: mocks.waiting,
}))
vi.mock("@/lib/data/cofog", () => ({
  getExpenditureFunctions: mocks.spending,
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/servicios/sanidad",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
import Page from "./page"
beforeEach(() => {
  mocks.waiting.mockResolvedValue({ snapshot: fixture, error: false })
  mocks.spending.mockResolvedValue({
    years: [
      {
        year: 2024,
        values: { GF07: 100000 },
        lastChecked: null,
        provisional: true,
      },
    ],
    error: false,
  })
})
it("keeps the regional waiting stock separate from national spending and periods", async () => {
  const html = renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({
        territory: "08",
        cut: "2025-12-31",
        spendingYear: "2024",
      }),
    }),
  )
  expect(html).toContain("36.491")
  expect(html).toContain("117 días")
  expect(html).toContain("millones de euros · 2024")
  expect(html).toContain("2026-09-24")
  expect(html).toContain("El gasto nacional no se atribuye")
  expect(html).toContain("no promete una fecha")
  expect(html).toContain('name="spendingYear"')
  expect(html).toContain('name="territory"')
  expect(html).toContain("#page=8")
})
it("does not silently fall back from invalid territory or spending year", async () => {
  const html = renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({ territory: "99", spendingYear: "2025" }),
    }),
  )
  expect(html).toContain("territorio o corte solicitado no está disponible")
  expect(html).toContain("no tiene un desglose reconciliado")
  expect(html).not.toContain("853.740")
  expect(html).not.toContain("100.000")
})
it("distinguishes source failure from missing edition", async () => {
  mocks.waiting.mockResolvedValue({ snapshot: null, error: true })
  const failed = renderToStaticMarkup(await Page({}))
  expect(failed).toContain("Un fallo no significa cero pacientes")
  expect(failed).not.toContain("Pacientes pendientes</dt>")
  mocks.waiting.mockResolvedValue({ snapshot: null, error: false })
  expect(renderToStaticMarkup(await Page({}))).toContain(
    "Todavía no hay una edición disponible",
  )
})
