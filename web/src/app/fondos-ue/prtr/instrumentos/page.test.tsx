import { expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import fixture from "@/lib/mrr-instrument-fixture.json"
import { mrrSnapshot } from "@/lib/mrr-instruments"
const mock = vi.hoisted(() => ({ result: {} as unknown }))
vi.mock("@/lib/data/mrr-instruments", () => ({ getMrrInstruments: async () => mock.result }))
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }))
vi.mock("@/components/navigation/NavigationProgress", () => ({ ResponsiveLink: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }))
import Page from "./page"
it("renders annuality, publication, signatures and correct instrument stages", async () => {
  mock.result = { snapshot: mrrSnapshot(fixture), error: false }
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ year: "2026" }) }))
  for (const fragment of ["192.000.000,00", "300.000.000,00", "600.000.000,00", "0,00", "compromisos", "REOICO", "Israel Arroyo Martínez", "capital y cuasicapital", "contratos formalizados", "name=\"year\"", "?year=2026"]) expect(html).toContain(fragment)
  expect(html).not.toContain("22.000.000.000")
  expect(html).not.toContain("8.150.000.000")
})
it("distinguishes absent, failed and invalid URL states", async () => {
  mock.result = { snapshot: null, error: true }
  expect(renderToStaticMarkup(await Page({}))).toContain('role="alert"')
  mock.result = { snapshot: null, error: false }
  expect(renderToStaticMarkup(await Page({}))).toContain("Todavía no hay")
  mock.result = { snapshot: mrrSnapshot(fixture), error: false }
  const invalid = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ year: "2027" }) }))
  expect(invalid).toContain("No se sustituye")
})
