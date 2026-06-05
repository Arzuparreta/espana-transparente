import { describe, it, expect } from "vitest"
import {
  getPopulationForYear,
  computeDebtPerCapita,
  getDebtContext,
  monthsOfSalary,
} from "./debt-per-capita"

describe("getPopulationForYear", () => {
  it("returns exact value for known year", () => {
    expect(getPopulationForYear(2023)).toBeCloseTo(48.08, 2)
    expect(getPopulationForYear(2000)).toBeCloseTo(40.40, 2)
  })

  it("interpolates between known years", () => {
    // 2023 = 48.08, 2024 = 48.60 → midpoint ≈ 48.34
    expect(getPopulationForYear(2023.5)).toBeCloseTo(48.34, 2)
  })

  it("clamps below minimum", () => {
    expect(getPopulationForYear(1990)).toBe(39.30)
  })

  it("clamps above maximum", () => {
    expect(getPopulationForYear(2030)).toBe(48.60)
  })
})

describe("computeDebtPerCapita", () => {
  it("calculates per-capita debt correctly", () => {
    const series = [
      { period: "2023", value: 1_500_000, unit: "millones EUR" },
    ]
    const result = computeDebtPerCapita(series)
    expect(result).toHaveLength(1)
    // 1,500,000 millones EUR / 48.08 millones personas = ~31,199 EUR/persona
    expect(result[0].perCapita).toBeCloseTo(1500000 / 48.08, 0)
    expect(result[0].populationMillions).toBeCloseTo(48.08, 2)
  })

  it("handles multiple years", () => {
    const series = [
      { period: "2022", value: 1_400_000, unit: "millones EUR" },
      { period: "2023", value: 1_500_000, unit: "millones EUR" },
    ]
    const result = computeDebtPerCapita(series)
    expect(result).toHaveLength(2)
    expect(result[0].period).toBe("2022")
    expect(result[1].period).toBe("2023")
  })

  it("filters out invalid values", () => {
    const series = [
      { period: "2023", value: NaN, unit: "millones EUR" },
      { period: "2023", value: 1_500_000, unit: "millones EUR" },
    ]
    const result = computeDebtPerCapita(series)
    expect(result).toHaveLength(1)
  })
})

describe("getDebtContext", () => {
  it("returns null for empty series", () => {
    expect(getDebtContext([])).toBeNull()
  })

  it("calculates 10-year change", () => {
    const series = [
      { period: "2013", debtTotalMillions: 900_000, populationMillions: 46.59, perCapita: 900_000 / 46.59 },
      { period: "2023", debtTotalMillions: 1_500_000, populationMillions: 48.08, perCapita: 1_500_000 / 48.08 },
    ]
    const ctx = getDebtContext(series)
    expect(ctx).not.toBeNull()
    expect(ctx!.latestPeriod).toBe("2023")
    expect(ctx!.tenYearsAgoPeriod).toBe("2013")
    expect(ctx!.changeAbsolute10Y).toBeCloseTo(
      1_500_000 / 48.08 - 900_000 / 46.59,
      0
    )
  })

  it("handles missing 10-year point gracefully", () => {
    const series = [
      { period: "2023", debtTotalMillions: 1_500_000, populationMillions: 48.08, perCapita: 1_500_000 / 48.08 },
    ]
    const ctx = getDebtContext(series)
    expect(ctx).not.toBeNull()
    expect(ctx!.tenYearsAgoPeriod).toBeNull()
    expect(ctx!.changePercent10Y).toBeNull()
  })
})

describe("monthsOfSalary", () => {
  it("calculates months correctly", () => {
    // 30,000 EUR debt per capita / (25,000 EUR annual / 12) = 14.4 months
    expect(monthsOfSalary(30_000, 25_000)).toBeCloseTo(14.4, 1)
  })

  it("returns 0 for invalid salary", () => {
    expect(monthsOfSalary(30_000, 0)).toBe(0)
    expect(monthsOfSalary(30_000, NaN)).toBe(0)
  })
})
