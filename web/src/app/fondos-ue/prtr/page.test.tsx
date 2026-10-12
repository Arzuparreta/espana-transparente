import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/data/prtr-program", () => ({ getDusProgram: mock }))
vi.mock("next/navigation", () => ({
  usePathname: () => "/fondos-ue/prtr",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
import Page from "./page"
const sql = readFileSync(
  new URL(
    "../../../../../supabase/migrations/20261012130000_prtr_dus5000.sql",
    import.meta.url,
  ),
  "utf8",
)
const seed = JSON.parse(
  sql.match(/VALUES \('DUS5000','(.+)'::jsonb\)/)![1].replace(/''/g, "'"),
)
beforeEach(() => mock.mockResolvedValue({ snapshot: seed, error: false }))
it("renders the question phase budget and project links before the catalogue", async () => {
  const html = renderToStaticMarkup(
    await Page({
      searchParams: Promise.resolve({ territory: "13", q: "ajalvir" }),
    }),
  )
  expect(html).toContain("557.351,59")
  expect(html).toContain("PR-D5000-2021-000035")
  expect(html).toContain("no pagos ni proyectos terminados")
  expect(html).toContain("no permite sumar concesiones nuevas por año")
  expect(html).toContain('name="territory"')
  expect(html).toContain("?territory=13&amp;q=ajalvir")
})
it("separates invalid empty results and unavailable database", async () => {
  const invalid = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ territory: "99" }) }),
  )
  expect(invalid).toContain("no está disponible")
  expect(invalid).not.toContain("336.902.058")
  const empty = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ q: "zzzzzzzznotpresent" }) }),
  )
  expect(empty).toContain("No hay expedientes publicados")
  mock.mockResolvedValue({ snapshot: null, error: true })
  expect(renderToStaticMarkup(await Page({}))).toContain(
    "Un error no significa que no haya ayudas",
  )
})
