import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"

const search = vi.hoisted(() => vi.fn(async () => ({ results: [], total: 0, error: false })))
vi.mock("@/lib/data/search", () => ({ searchDocumentPage: search }))
vi.mock("@/lib/data", () => ({ parsePage: (value?: string) => Number(value ?? 1) || 1 }))
vi.mock("@/components/search/SearchResults", () => ({ SearchResults: () => null }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(), usePathname: () => "/buscar", useRouter: () => ({ prefetch: vi.fn() }), useSearchParams: () => new URLSearchParams(),
}))
import Page from "./page"

it("answers a topic query before listing matching records", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: "vivienda" }) }))
  expect(html).toContain("Respuestas documentadas sobre «vivienda»")
  expect(html).toContain('href="/precios-vivienda"')
  expect(html.indexOf("Respuestas documentadas")).toBeLessThan(html.indexOf("resultados · página"))
})

it("keeps a name search as a plain record search and ignores prototype keys as collections", async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: "Pedro Sánchez", type: "constructor" }) }))
  expect(html).not.toContain("Respuestas documentadas")
  expect(search).toHaveBeenLastCalledWith("Pedro Sánchez", { type: undefined, year: undefined, page: 1 })
})
