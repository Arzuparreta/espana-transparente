import { describe, it, expect } from "vitest"
import {
  FISCAL_SERIES,
  fiscalYears,
  selectFiscalRange,
  selectFiscalYear,
  fiscalYearSummary,
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
  it("selects exact available years, and explicitly falls back across gaps", () => {
    const years = fiscalYears([...rows("2022"), ...rows("2024")])
    expect(selectFiscalYear(years).selected?.year).toBe(2024)
    expect(selectFiscalYear(years).unavailable).toBe(false)
    expect(selectFiscalYear(years, "2022").selected?.year).toBe(2022)
    expect(selectFiscalYear(years, "2022").unavailable).toBe(false)
    for (const request of ["2023", "2099", "invalid", "", ["2022", "2024"]]) {
      expect(selectFiscalYear(years, request)).toMatchObject({
        selected: { year: 2024 },
        unavailable: true,
      })
    }
    expect(selectFiscalYear([]).selected).toBeUndefined()
  })
  it.each([-20, 0, 20])(
    "uses the selected year's signed balance %s and consistent ratio",
    (balance) => {
      const row = fiscalYears(rows())[0]
      row.values.INGRESOS_PUBLICOS = 100
      row.values.GASTO_PUBLICO = 100 - balance
      row.values.SALDO_PUBLICO = balance
      expect(fiscalYearSummary(row)).toMatchObject({
        balance,
        spendingPer100Income: 100 - balance,
        status: balance < 0 ? "deficit" : balance > 0 ? "surplus" : "balanced",
      })
    },
  )
  it.each([0, -10])("does not compute a ratio for income %s", (income) => {
    const row = fiscalYears(rows())[0]
    row.values.INGRESOS_PUBLICOS = income
    expect(fiscalYearSummary(row).spendingPer100Income).toBeNull()
  })
})
