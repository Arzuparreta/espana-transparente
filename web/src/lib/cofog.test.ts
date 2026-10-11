import { describe, expect, it } from "vitest"
import { cofogYears, selectCofogYear } from "./cofog"
import { rows } from "./cofog-fixtures"

describe("COFOG publication contract", () => {
  it("reconciles ten divisions without counting TOTAL twice and preserves zero", () => {
    expect(cofogYears(rows()).years[0].total).toBe(100)
    expect(
      Object.values(cofogYears(rows()).years[0].values).reduce((a, b) => a + b),
    ).toBe(100)
    expect(cofogYears(rows(0)).years[0].total).toBe(0)
  })
  it.each(["missing", "duplicate", "scope", "sum", "accounts", "unit", "nan"])(
    "excludes %s without fabricating a remainder",
    (issue) => {
      const sample = rows()
      if (issue === "missing") sample.pop()
      if (issue === "duplicate") sample[1] = sample[0]
      if (issue === "scope") sample[1].sector = "S1311"
      if (issue === "sum") sample[1].value = 30
      if (issue === "accounts") sample[1].raw_data!.accounts_total = "110"
      if (issue === "unit") sample[1].unit = "PC_GDP"
      if (issue === "nan") sample[1].value = NaN
      expect(cofogYears(sample)).toEqual({ years: [], rejectedYears: [2024] })
    },
  )
  it("retains provisionality and does not silently change an unavailable year", () => {
    const sample = rows()
    sample[1].raw_data!.flags = ["p"]
    const years = cofogYears(sample).years
    expect(years[0].provisional).toBe(true)
    expect(selectCofogYear(years)?.year).toBe(2024)
    for (const value of ["2025", "2024junk", ["2024"], ""])
      expect(selectCofogYear(years, value)).toBeUndefined()
  })
})
