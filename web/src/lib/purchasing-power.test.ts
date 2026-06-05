import { describe, expect, it } from "vitest"

import {
  computePurchasingPower,
  sortIndexAscending,
  type IndexPoint,
} from "./purchasing-power"

const SERIES: IndexPoint[] = [
  { period: "2015-01", value: 80 },
  { period: "2020-01", value: 90 },
  { period: "2025-01", value: 100 },
]

describe("sortIndexAscending", () => {
  it("orders oldest first and drops invalid points", () => {
    const out = sortIndexAscending([
      { period: "2025-01", value: 100 },
      { period: "bad", value: 50 },
      { period: "2015-01", value: 80 },
      { period: "2020-01", value: 0 },
    ])
    expect(out.map((p) => p.period)).toEqual(["2015-01", "2025-01"])
  })
})

describe("computePurchasingPower", () => {
  it("adjusts an amount forward by the index ratio", () => {
    const r = computePurchasingPower(SERIES, 1000, "2015-01", "2025-01")
    expect(r).not.toBeNull()
    // 1000 * 100/80 = 1250
    expect(r!.equivalent).toBeCloseTo(1250, 6)
    expect(r!.accumulatedInflationPct).toBeCloseTo(25, 6)
  })

  it("defaults toPeriod to the latest available observation", () => {
    const r = computePurchasingPower(SERIES, 1000, "2015-01")
    expect(r!.toPeriod).toBe("2025-01")
    expect(r!.equivalent).toBeCloseTo(1250, 6)
  })

  it("computes the real value of money kept nominal", () => {
    const r = computePurchasingPower(SERIES, 1000, "2015-01", "2025-01")
    // 1000 * 80/100 = 800 real value; 200 lost
    expect(r!.realValueOfKeptMoney).toBeCloseTo(800, 6)
    expect(r!.purchasingPowerLost).toBeCloseTo(200, 6)
  })

  it("annualizes inflation over the span", () => {
    const r = computePurchasingPower(SERIES, 1000, "2015-01", "2025-01")
    // (100/80)^(1/10) - 1 ≈ 2.2565%
    expect(r!.annualizedInflationPct).toBeCloseTo(2.2565, 3)
  })

  it("returns null for missing periods or non-positive amounts", () => {
    expect(computePurchasingPower(SERIES, 1000, "1999-01")).toBeNull()
    expect(computePurchasingPower(SERIES, 0, "2015-01")).toBeNull()
    expect(computePurchasingPower(SERIES, -50, "2015-01")).toBeNull()
    expect(computePurchasingPower([], 1000, "2015-01")).toBeNull()
  })
})
