import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  FISCAL_SERIES,
  fiscalYears,
  type FiscalObservation,
} from "@/lib/fiscal"
import { PublicMoneyOverview } from "@/components/chain/PublicMoneyOverview"

const mocks = vi.hoisted(() => ({
  accounts: vi.fn(),
  index: vi.fn(),
  redirect: vi.fn(),
}))
vi.mock("@/lib/data", () => ({ getSectionIndex: mocks.index }))
vi.mock("@/lib/data/fiscal", () => ({ getFiscalAccounts: mocks.accounts }))
vi.mock("next/navigation", () => ({
  permanentRedirect: mocks.redirect,
  usePathname: () => "/dinero",
  useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
import Page, { generateMetadata } from "./page"

function accounts(balance = -20, income = 100) {
  const rows: FiscalObservation[] = Object.keys(FISCAL_SERIES).map((code) => ({
    indicator_code: code,
    period: "2024",
    value:
      code === "INGRESOS_PUBLICOS"
        ? income
        : code === "GASTO_PUBLICO"
          ? income - balance
          : code === "SALDO_PUBLICO"
            ? balance
            : 10,
    unit: "millones EUR",
    raw_data: { flags: ["p"] },
  }))
  return {
    years: fiscalYears(rows),
    lastChecked: "2026-10-11T00:00:00Z",
    error: false,
  }
}

describe("public money annual answer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.index.mockResolvedValue([])
    mocks.accounts.mockResolvedValue(accounts())
    mocks.redirect.mockImplementation((target) => {
      throw new Error(`redirect:${target}`)
    })
  })
  it("answers before the directory and retains every collection", async () => {
    const html = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({ year: "2024" }) }),
    )
    expect(html.indexOf("Se gastó más")).toBeLessThan(
      html.indexOf('aria-label="Datos disponibles"'),
    )
    for (const href of [
      "cuentas-publicas",
      "presupuestos",
      "contratos",
      "subvenciones",
      "fondos-ue",
      "dinero-publico",
    ]) {
      expect(html).toContain(`href="/${href}`)
    }
    expect(html).not.toContain("Mayor contrato")
    expect(html).not.toContain("Registros de gasto")
    expect(html).toContain("no el total de fondos europeos")
    expect(html).not.toContain("line-clamp-2")
    expect(html).toContain("ES · S13 · MIO_EUR")
    expect(html).toContain("gov_10a_main/default/table")
    expect(html).toContain("Datos provisionales")
    expect(html).toContain("/cuentas-publicas?desde=2024&amp;hasta=2024")
    expect(html).toContain('href="/dinero?year=2024"')
    expect(html).toContain('name="year"')
  })
  it.each([
    [-20, "Se gastó más", "Déficit"],
    [20, "Los ingresos superaron", "Superávit"],
    [0, "estuvieron equilibrados", "Saldo en equilibrio"],
  ])("changes the explanation for balance %s", (balance, title, label) => {
    const html = renderToStaticMarkup(
      <PublicMoneyOverview accounts={accounts(balance)} />,
    )
    expect(html).toContain(title)
    expect(html).toContain(label)
    expect(html).toContain("Ya incluidos en el gasto total")
  })
  it("does not divide by zero or replace missing accounts with zero", () => {
    const zero = renderToStaticMarkup(
      <PublicMoneyOverview accounts={accounts(-20, 0)} />,
    )
    expect(zero).toContain("los ingresos no son positivos")
    expect(zero).not.toContain("Infinity")
    const missing = renderToStaticMarkup(
      <PublicMoneyOverview
        accounts={{ years: [], lastChecked: null, error: false }}
      />,
    )
    expect(missing).toContain("Todavía no hay un año completo")
    expect(missing).not.toContain("Saldo en equilibrio")
    expect(missing).not.toContain('name="year"')
  })
  it("reports failure separately and explains unavailable years", () => {
    const failed = renderToStaticMarkup(
      <PublicMoneyOverview
        accounts={{ years: [], lastChecked: null, error: true }}
      />,
    )
    expect(failed).toContain('role="alert"')
    expect(failed).toContain("No se han podido consultar")
    const invalid = renderToStaticMarkup(
      <PublicMoneyOverview accounts={accounts()} year="2023" />,
    )
    expect(invalid).toContain("El año solicitado no está disponible")
    expect(invalid).toContain("cuentas completas: 2024")
  })
  it("keeps the historical trace redirect and its filters", async () => {
    await expect(
      Page({
        searchParams: Promise.resolve({
          view: "trazabilidad",
          year: "2023",
          section: "26",
          program: "261N",
        }),
      }),
    ).rejects.toThrow(
      "redirect:/dinero-publico?year=2023&section=26&program=261N",
    )
    expect(mocks.accounts).not.toHaveBeenCalled()
    expect(mocks.index).not.toHaveBeenCalled()
  })
  it("publishes metadata for the annual answer", async () => {
    const metadata = await generateMetadata({})
    expect(metadata.alternates).toEqual({ canonical: "/dinero" })
    expect(metadata.description).toContain("Cuánto ingresan y gastan")
  })
})
