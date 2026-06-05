import { describe, it, expect } from "vitest"
import {
  computeBasketInflation,
  getAvailableYears,
  DEFAULT_BASKET_WEIGHTS,
} from "./ipc-basket"
import type { SubgroupSeries } from "./ipc-basket"

function mockSeries(): SubgroupSeries[] {
  // Base 2025 = 100. Let's say Jan 2023 = 90, Jan 2024 = 95, Jan 2025 = 100
  const generalPoints = [
    { period: "2023-01", value: 90 },
    { period: "2023-02", value: 91 },
    { period: "2024-01", value: 95 },
    { period: "2024-02", value: 96 },
    { period: "2025-01", value: 100 },
  ]
  const alimentosPoints = [
    { period: "2023-01", value: 85 },
    { period: "2023-02", value: 86 },
    { period: "2024-01", value: 96 },
    { period: "2024-02", value: 97 },
    { period: "2025-01", value: 105 },
  ]
  const transportePoints = [
    { period: "2023-01", value: 95 },
    { period: "2023-02", value: 96 },
    { period: "2024-01", value: 94 },
    { period: "2024-02", value: 95 },
    { period: "2025-01", value: 100 },
  ]

  // Fill remaining subgroups with flat data so the test doesn't break
  const flatPoints = generalPoints.map((p) => ({ period: p.period, value: p.value }))
  const otherCodes = Object.keys(DEFAULT_BASKET_WEIGHTS).filter(
    (c) => c !== "IPC_ALIMENTOS" && c !== "IPC_TRANSPORTE"
  )

  return [
    { code: "IPC", name: "Índice general", points: generalPoints },
    { code: "IPC_ALIMENTOS", name: "Alimentos", points: alimentosPoints },
    { code: "IPC_TRANSPORTE", name: "Transporte", points: transportePoints },
    ...otherCodes.map((code) => ({ code, name: code, points: flatPoints })),
  ]
}

describe("computeBasketInflation", () => {
  it("returns null when IPC general is missing", () => {
    const result = computeBasketInflation([], {}, "2023")
    expect(result).toBeNull()
  })

  it("calculates general inflation correctly", () => {
    const series = mockSeries()
    const weights = { ...DEFAULT_BASKET_WEIGHTS }
    const result = computeBasketInflation(series, weights, "2023")
    expect(result).not.toBeNull()
    // General: 100/90 - 1 = 11.11%
    expect(result!.generalInflation).toBeCloseTo(11.11, 1)
  })

  it("calculates weighted basket inflation", () => {
    const series = mockSeries()
    // Put 100% weight on alimentos (inflation ~23.5%) and 0 on rest
    const weights = Object.fromEntries(
      Object.keys(DEFAULT_BASKET_WEIGHTS).map((k) => [k, k === "IPC_ALIMENTOS" ? 100 : 0])
    ) as Record<string, number>

    const result = computeBasketInflation(series, weights, "2023")
    expect(result).not.toBeNull()
    // Alimentos: 105/85 - 1 = 23.53%
    expect(result!.basketInflation).toBeCloseTo(23.53, 1)
    expect(result!.generalInflation).toBeCloseTo(11.11, 1)
    expect(result!.gap).toBeCloseTo(12.42, 1)
  })

  it("normalizes weights when total != 100", () => {
    const series = mockSeries()
    // Put 50 on alimentos and 50 on transporte → should normalize to 50/50
    const weights = Object.fromEntries(
      Object.keys(DEFAULT_BASKET_WEIGHTS).map((k) => [
        k,
        k === "IPC_ALIMENTOS" ? 50 : k === "IPC_TRANSPORTE" ? 50 : 0,
      ])
    ) as Record<string, number>

    const result = computeBasketInflation(series, weights, "2023")
    expect(result).not.toBeNull()
    // Alimentos: 23.53%, Transporte: 5.26%
    // Basket = 0.5*23.53 + 0.5*5.26 = 14.395%
    expect(result!.basketInflation).toBeCloseTo(14.4, 0)
  })
})

describe("getAvailableYears", () => {
  it("returns sorted years from IPC general series", () => {
    const series = mockSeries()
    const years = getAvailableYears(series)
    expect(years).toEqual(["2023", "2024", "2025"])
  })

  it("returns empty array when no IPC general", () => {
    expect(getAvailableYears([])).toEqual([])
  })
})
