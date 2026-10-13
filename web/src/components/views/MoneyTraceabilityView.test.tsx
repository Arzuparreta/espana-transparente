import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"
import type { MoneyFlowSection } from "@/lib/data/money-flow"

const mocks = vi.hoisted(() => ({ flow: vi.fn() }))
vi.mock("@/lib/data", () => ({
  BUDGET_YEARS: [2023, 2024], getBudgetYearMeta: () => ({ label: "PGE" }),
  getMinistryBeneficiariesLastRefreshed: async () => null,
  getMoneyFlowYear: mocks.flow, getEtlLastFinished: async () => null,
  getEuFundsSummary: async () => null,
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/dinero-publico", useRouter: () => ({ prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
import { MoneyTraceabilityView } from "./MoneyTraceabilityView"

const section: MoneyFlowSection = {
  section_code: "01", section_name: "Hacienda", ministry_normalized: "Hacienda",
  minister_person_id: null, minister_name: null, total_credit_initial: 0,
  contract_count: 7, contract_total: 0, subsidy_count: 2, subsidy_total: 0,
  latest_record_date: null, programs: [{ program_code: "001", program_name: "Programa", total_credit_initial: 0 }],
  top_contractors: [], top_subsidy_beneficiaries: [], eu_fund_summary: null,
}
beforeEach(() => { vi.clearAllMocks(); mocks.flow.mockResolvedValue([section]) })
it("separates annual budgets from historical operations and keeps supported link periods", async () => {
  const html = renderToStaticMarkup(await MoneyTraceabilityView({ searchParams: { year: "2023" } }))
  expect(mocks.flow).toHaveBeenCalledWith(2023)
  expect(html).toContain("sin filtro anual")
  expect(html).toContain("ni permite calcular su ejecución")
  expect(html).toContain("0 €")
  expect(html).toContain('href="/presupuestos/01?year=2023"')
  expect(html).toContain('href="/contratos?ministry=Hacienda"')
  expect(html).not.toContain('/contratos?ministry=Hacienda&amp;year=')
  expect(html).not.toContain("Fondos UE vinculados")
})
it("does not accept a partially numeric year", async () => {
  await MoneyTraceabilityView({ searchParams: { year: "2023oops" } })
  expect(mocks.flow).toHaveBeenCalledWith(2024)
})
it("does not present missing credits as zero or a partial total", async () => {
  mocks.flow.mockResolvedValue([{ ...section, total_credit_initial: null }])
  const html = renderToStaticMarkup(await MoneyTraceabilityView({}))
  expect(html).toContain("Hay créditos sin importe disponible")
})
