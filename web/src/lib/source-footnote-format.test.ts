import { describe, expect, it } from "vitest"
import {
  clampPercent,
  formatCoveragePercent,
  formatSourceDate,
  SIN_VERIFICAR,
} from "./source-footnote-format"

describe("formatSourceDate", () => {
  it("returns Sin verificar for missing values", () => {
    expect(formatSourceDate(null)).toBe(SIN_VERIFICAR)
    expect(formatSourceDate(undefined)).toBe(SIN_VERIFICAR)
    expect(formatSourceDate("not-a-date")).toBe(SIN_VERIFICAR)
  })

  it("formats valid ISO dates in es-ES", () => {
    expect(formatSourceDate("2026-05-20")).toMatch(/20/)
    expect(formatSourceDate("2026-05-20")).toMatch(/2026/)
  })
})

describe("clampPercent", () => {
  it("clamps to 0-100", () => {
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent(150)).toBe(100)
    expect(clampPercent(42.7)).toBe(42.7)
  })
})

describe("formatCoveragePercent", () => {
  it("renders integer percents without decimals", () => {
    expect(formatCoveragePercent(80)).toBe("80%")
  })

  it("clamps overflow", () => {
    expect(formatCoveragePercent(200)).toBe("100%")
  })
})
