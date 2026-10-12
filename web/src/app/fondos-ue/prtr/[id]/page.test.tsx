import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
const mock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/data/prtr-program", () => ({ getDusProgram: mock }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found")
  },
  usePathname: () => "/fondos-ue/prtr",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
import Page from "./page"
const sql = readFileSync(
  new URL(
    "../../../../../../supabase/migrations/20261012130000_prtr_dus5000.sql",
    import.meta.url,
  ),
  "utf8",
)
const seed = JSON.parse(
  sql.match(/VALUES \('DUS5000','(.+)'::jsonb\)/)![1].replace(/''/g, "'"),
)
it("preserves query context without inferring payment or named responsibility", async () => {
  mock.mockResolvedValue({ snapshot: seed, error: false })
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "PR-D5000-2021-000035" }),
      searchParams: Promise.resolve({
        territory: "13",
        q: "ajalvir",
        page: "1",
      }),
    }),
  )
  expect(html).toContain("?territory=13&amp;q=ajalvir&amp;page=1")
  expect(html).toContain("Volver a la consulta")
  expect(html).toContain("sin evidencia individual incorporada")
  expect(html).toContain("por ocupar entonces un cargo")
  expect(html).toContain("557.351,59")
})
it("a missing record is different from database failure", async () => {
  mock.mockResolvedValue({ snapshot: seed, error: false })
  await expect(
    Page({ params: Promise.resolve({ id: "PR-D5000-2021-999999" }) }),
  ).rejects.toThrow("not found")
  mock.mockResolvedValue({ snapshot: null, error: true })
  expect(
    renderToStaticMarkup(
      await Page({ params: Promise.resolve({ id: "PR-D5000-2021-000035" }) }),
    ),
  ).toContain("No se ha podido consultar")
})
