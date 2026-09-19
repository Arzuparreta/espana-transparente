import { describe, it, expect } from "vitest"
import {
  FISCAL_SERIES,
  fiscalYears,
  selectFiscalRange,
  type FiscalObservation,
} from "./fiscal"
function rows(year = "2024"): FiscalObservation[] {
  return Object.keys(FISCAL_SERIES).map((code) => ({
    indicator_code: code,
    period: year,
    value: code === "SALDO_PUBLICO" ? 0 : 100,
    unit: "millones EUR",
    raw_data: { flags: ["p"] },
  }))
}
describe("comparable public accounts", () => {
  it("preserves genuine zeros and provisional flags", () => {
    expect(fiscalYears(rows())[0].values.SALDO_PUBLICO).toBe(0)
    expect(fiscalYears(rows())[0].provisional).toBe(true)
  })
  it("does not treat missing values as zero or mix units", () => {
    const data = rows()
    data[0].value = null
    expect(fiscalYears(data)).toEqual([])
    data[0].value = 100
    data[0].unit = "EUR"
    expect(fiscalYears(data)).toEqual([])
  })
  it("rejects unreconciled years", () => {
    const data = rows()
    data[0].value = 300
    expect(fiscalYears(data)).toEqual([])
  })
  it("normalizes reversed and unavailable ranges", () => {
    const years = fiscalYears([...rows("2023"), ...rows("2024")])
    expect(selectFiscalRange(years, "2099", "1900").years).toHaveLength(2)
  })
})
