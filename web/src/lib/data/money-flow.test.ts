import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ from: vi.fn(), results: {} as Record<string, unknown> }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/client", () => ({ supabase: { from: mocks.from } }))
import { getMoneyFlowYear } from "./money-flow"

beforeEach(() => {
  mocks.results = {
    v_program_money_flow: { data: [], error: null },
    v_ministry_top_beneficiaries: { data: [], error: null },
    v_section_eu_fund_summary: { data: [], error: null },
  }
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: () => query, eq: () => query, order: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(mocks.results[table]).then(resolve),
    }
    return query
  })
})
it.each(["v_program_money_flow", "v_ministry_top_beneficiaries", "v_section_eu_fund_summary"])("does not disguise a failed %s query as empty data", async (table) => {
  mocks.results[table] = { data: null, error: { message: "statement timeout" } }
  await expect(getMoneyFlowYear(2024)).rejects.toThrow("statement timeout")
})
it("keeps missing credits unknown across multiple programs while preserving real zero", async () => {
  const row = { section_code: "01", program_code: "001", total_credit_initial: 0 }
  mocks.results.v_program_money_flow = { data: [row], error: null }
  expect((await getMoneyFlowYear(2024))[0].total_credit_initial).toBe(0)
  mocks.results.v_program_money_flow = { data: [row, { ...row, program_code: "002", total_credit_initial: null }], error: null }
  expect((await getMoneyFlowYear(2024))[0].total_credit_initial).toBeNull()
})
