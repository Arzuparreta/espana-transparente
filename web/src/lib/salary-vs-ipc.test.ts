import { describe, expect, it } from "vitest"
import {
  computeSalaryVsIpc,
  extractYearIpcPoints,
  getAvailableYears,
  type IndexPoint,
} from "./salary-vs-ipc"

const MOCK_SERIES: IndexPoint[] = [
  // 2019
  { period: "2019-01", value: 95 },
  { period: "2019-06", value: 96 },
  { period: "2019-12", value: 97 },
  // 2020
  { period: "2020-01", value: 98 },
  { period: "2020-12", value: 100 },
  // 2021
  { period: "2021-03", value: 102 },
  { period: "2021-12", value: 104 },
  // 2022
  { period: "2022-06", value: 108 },
  { period: "2022-12", value: 110 },
]

describe("extractYearIpcPoints", () => {
  it("picks the last month of each year", () => {
    const years = extractYearIpcPoints(MOCK_SERIES)
    expect(years.map((y) => y.year)).toEqual(["2019", "2020", "2021", "2022"])
    expect(years.find((y) => y.year === "2019")?.value).toBe(97)
    expect(years.find((y) => y.year === "2020")?.value).toBe(100)
    expect(years.find((y) => y.year === "2021")?.value).toBe(104)
    expect(years.find((y) => y.year === "2022")?.value).toBe(110)
  })

  it("returns empty for empty series", () => {
    expect(extractYearIpcPoints([])).toEqual([])
  })

  it("ignores invalid points", () => {
    const bad = [
      { period: "2019-01", value: 95 },
      { period: "bad", value: 96 },
      { period: "2019-03", value: -1 },
      { period: "2019-04", value: NaN },
    ]
    expect(extractYearIpcPoints(bad)).toEqual([
      { year: "2019", period: "2019-01", value: 95 },
    ])
  })
})

describe("getAvailableYears", () => {
  it("returns sorted years", () => {
    expect(getAvailableYears(MOCK_SERIES)).toEqual([
      "2019",
      "2020",
      "2021",
      "2022",
    ])
  })
})

describe("computeSalaryVsIpc", () => {
  it("returns null for invalid salary", () => {
    expect(computeSalaryVsIpc(-1, "annual", "2020", "2022", MOCK_SERIES)).toBeNull()
    expect(computeSalaryVsIpc(0, "annual", "2020", "2022", MOCK_SERIES)).toBeNull()
    expect(computeSalaryVsIpc(NaN, "annual", "2020", "2022", MOCK_SERIES)).toBeNull()
  })

  it("returns null for missing years", () => {
    expect(computeSalaryVsIpc(20000, "annual", "2018", "2022", MOCK_SERIES)).toBeNull()
    expect(computeSalaryVsIpc(20000, "annual", "2020", "2025", MOCK_SERIES)).toBeNull()
  })

  it("adjusts annual salary correctly", () => {
    // 2020 -> 2022: IPC 100 -> 110, ratio 1.1
    const result = computeSalaryVsIpc(20000, "annual", "2020", "2022", MOCK_SERIES)
    expect(result).not.toBeNull()
    expect(result!.annualSalary).toBe(20000)
    expect(result!.equivalentAnnual).toBeCloseTo(22000, 1)
    expect(result!.equivalentMonthly).toBeCloseTo(22000 / 12, 1)
    expect(result!.accumulatedInflationPct).toBeCloseTo(10, 4)
    expect(result!.annualizedInflationPct).toBeCloseTo(
      (Math.pow(1.1, 12 / 24) - 1) * 100,
      4,
    )
  })

  it("normalizes monthly to annual", () => {
    // 1500/month in 2020 -> 2022
    const result = computeSalaryVsIpc(1500, "monthly", "2020", "2022", MOCK_SERIES)
    expect(result).not.toBeNull()
    expect(result!.annualSalary).toBe(18000)
    expect(result!.equivalentAnnual).toBeCloseTo(19800, 1)
  })

  it("defaults toYear to latest available", () => {
    const result = computeSalaryVsIpc(20000, "annual", "2020", undefined, MOCK_SERIES)
    expect(result).not.toBeNull()
    expect(result!.toYear).toBe("2022")
  })

  it("computes gap when current salary provided", () => {
    // 2020 -> 2022, annual 20000, current 25000
    const result = computeSalaryVsIpc(
      20000,
      "annual",
      "2020",
      "2022",
      MOCK_SERIES,
      25000,
      "annual",
    )
    expect(result).not.toBeNull()
    expect(result!.gapAnnual).toBeCloseTo(3000, 1) // 25000 - 22000
    expect(result!.gapPct).toBeCloseTo((3000 / 22000) * 100, 2)
    expect(result!.realValueOfCurrentSalary).toBeCloseTo(25000 / 1.1, 1)
  })

  it("computes gap with current monthly salary", () => {
    // 2020 -> 2022, started at 1500/month, now 1600/month
    const result = computeSalaryVsIpc(
      1500,
      "monthly",
      "2020",
      "2022",
      MOCK_SERIES,
      1600,
      "monthly",
    )
    expect(result).not.toBeNull()
    expect(result!.annualSalary).toBe(18000)
    expect(result!.equivalentAnnual).toBeCloseTo(19800, 1)
    expect(result!.currentAnnual).toBe(19200)
    expect(result!.gapAnnual).toBeCloseTo(-600, 1) // losing ground
    expect(result!.gapPct).toBeCloseTo((-600 / 19800) * 100, 2)
  })
})
