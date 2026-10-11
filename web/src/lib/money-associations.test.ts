import { describe, expect, it } from "vitest"
import type { MoneyFlowSection } from "@/lib/data/money-flow"
import { summarizeMinistryAssociations } from "./money-associations"

describe("historical ministry associations", () => {
  it("counts ministries once even when multiple sections share them", () => {
    const section = (ministry: string | null, contracts: number, subsidies: number) => ({
      ministry_normalized: ministry, contract_count: contracts, subsidy_count: subsidies,
    }) as MoneyFlowSection
    expect(summarizeMinistryAssociations([
      section("Hacienda", 7, 2), section("Hacienda", 7, 2),
      section("Sanidad", 3, 1), section(null, 9, 9),
    ])).toEqual({ contractCount: 10, subsidyCount: 3 })
    expect(summarizeMinistryAssociations([])).toEqual({ contractCount: 0, subsidyCount: 0 })
  })
})
