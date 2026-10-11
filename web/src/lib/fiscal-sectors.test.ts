import { expect, it } from "vitest"
import { sectorRows } from "./fiscal-sector-fixtures"
import { sectorYears, selectSectorYear } from "./fiscal-sectors"
it("reconciles balances without forcing non-consolidated flows to equal S13", () => {
  const result = sectorYears(sectorRows())
  expect(result.years).toHaveLength(1)
  expect(result.years[0].values.S13.TE).toBe(120)
  expect(result.years[0].values.S1311.TE).toBe(55)
  const rows = sectorRows()
  rows.forEach((r) => (r.value = 0))
  expect(sectorYears(rows).years[0].values.S13.TE).toBe(0)
})
it.each([
  "scope",
  "unit",
  "duplicate",
  "missing",
  "nan",
  "identity",
  "balance",
])("rejects %s", (issue) => {
  const rows = sectorRows()
  if (issue === "scope") rows[0].sector = "S1319"
  if (issue === "unit") rows[0].unit = "PC_GDP"
  if (issue === "duplicate") rows[1] = rows[0]
  if (issue === "missing") rows.pop()
  if (issue === "nan") rows[0].value = NaN
  if (issue === "identity") rows[0].value = 110
  if (issue === "balance") {
    rows[3].value = 60
    rows[5].value = 5
  }
  expect(sectorYears(rows)).toEqual({ years: [], rejectedYears: [2024] })
})
it("retains flags and does not substitute unavailable requested years", () => {
  const rows = sectorRows()
  rows[0].raw_data!.flags = ["p"]
  const years = sectorYears(rows).years
  expect(years[0].provisional).toBe(true)
  expect(selectSectorYear(years)?.year).toBe(2024)
  for (const year of ["2025", "2024junk", ["2024"], ""])
    expect(selectSectorYear(years, year)).toBeUndefined()
})
