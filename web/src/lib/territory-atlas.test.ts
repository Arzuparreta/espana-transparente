import { describe, expect, it } from "vitest"
import {
  aggregateTerritoryValues,
  latestCompleteYear,
  quantileIndex,
  quantileThresholds,
} from "./territory-atlas"

const territories = [
  { key: "A", name: "A", type: "ccaa" as const, parentKey: null, nutsCode: "ESA", sortOrder: 1 },
  { key: "B", name: "B", type: "ccaa" as const, parentKey: null, nutsCode: "ESB", sortOrder: 2 },
  { key: "A1", name: "A1", type: "province" as const, parentKey: "A", nutsCode: null, sortOrder: 1 },
]

const spend = [
  { dataset: "contracts" as const, year: 2024, ccaaKey: "A", provinceKey: "A1", recordCount: 2, totalAmount: 100, latestRecordDate: "2024-12-01" },
  { dataset: "subsidies" as const, year: 2024, ccaaKey: "A", provinceKey: null, recordCount: 1, totalAmount: 50, latestRecordDate: "2024-11-01" },
  { dataset: "contracts" as const, year: 2024, ccaaKey: "B", provinceKey: null, recordCount: 3, totalAmount: 300, latestRecordDate: "2024-10-01" },
]

it("aggregates CCAA across sources without losing province rows", () => {
  const rows = aggregateTerritoryValues({
    territories,
    spend,
    population: [
      { territoryKey: "A", year: 2024, population: 10 },
      { territoryKey: "B", year: 2024, population: 100 },
    ],
    dataset: "all",
    year: 2024,
  })
  expect(rows.find((row) => row.key === "A")).toMatchObject({
    amount: 150,
    records: 3,
    perCapita: 15,
  })
})

it("keeps province aggregation contract-only when no subsidy province exists", () => {
  const rows = aggregateTerritoryValues({
    territories,
    spend,
    population: [],
    dataset: "all",
    year: 2024,
    parentKey: "A",
  })
  expect(rows[0]).toMatchObject({ key: "A1", amount: 100, records: 2 })
})

describe("quantile scale", () => {
  it("creates stable buckets and reserves -1 for no data", () => {
    const thresholds = quantileThresholds([0, 10, 20, 30, 40, 50])
    expect(thresholds).toHaveLength(4)
    expect(quantileIndex(0, thresholds)).toBe(-1)
    expect(quantileIndex(50, thresholds)).toBe(4)
  })

  it("uses the strongest bucket when every visible value is equal", () => {
    expect(quantileIndex(100, [100, 100, 100, 100])).toBe(4)
  })
})

it("selects the latest completed year", () => {
  expect(latestCompleteYear([2026, 2025, 2024], 2026)).toBe(2025)
})
