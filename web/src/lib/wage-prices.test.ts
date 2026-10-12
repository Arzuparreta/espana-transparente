import { expect, it } from "vitest"
import { purchasingPower, selectPurchasingPowerYear, signedPercent } from "./wage-prices"

const ipc = (year: number, value: number, months = 12) =>
  Array.from({ length: months }, (_, i) => ({ indicator_code: "IPC", period: `${year}-${String(i + 1).padStart(2, "0")}`, value }))
const wage = (year: number, value: number) => ({ indicator_code: "SALARIO_MEDIO", period: `${year}-A`, value })
const rows = [...ipc(2022, 100), ...ipc(2023, 105), ...ipc(2024, 105), ...ipc(2025, 110, 8), wage(2022, 1000), wage(2023, 1100), wage(2024, 1100)]

it("compares wage growth with the change of the annual CPI average, complete years only", () => {
  const data = purchasingPower(rows)!
  expect(data.baseYear).toBe(2022)
  expect(data.years.map((r) => r.year)).toEqual([2023, 2024])
  expect(data.years[0].wageChange).toBeCloseTo(0.1)
  expect(data.years[0].priceChange).toBeCloseTo(0.05)
  expect(data.years[0].realChange).toBeCloseTo(1.1 / 1.05 - 1)
})

it("chains cumulative changes from the base year and refuses unknown years", () => {
  const data = purchasingPower(rows)
  const selected = selectPurchasingPowerYear(data)!
  expect(selected.year).toBe(2024)
  expect(selected.cumulativeWage).toBeCloseTo(0.1)
  expect(selected.cumulativePrice).toBeCloseTo(0.05)
  expect(selectPurchasingPowerYear(data, "2030")).toBeUndefined()
  expect(selectPurchasingPowerYear(null)).toBeNull()
})

it("does not compute without both series or with a gap", () => {
  expect(purchasingPower(ipc(2023, 100))).toBeNull()
  const gap = [...ipc(2020, 99), ...ipc(2021, 100), ...ipc(2023, 101), ...ipc(2024, 102), ...ipc(2025, 103), wage(2020, 1), wage(2021, 1), wage(2023, 1), wage(2024, 1), wage(2025, 1)]
  expect(purchasingPower(gap)).toMatchObject({ baseYear: 2023, years: [{ year: 2024 }, { year: 2025 }] })
})

it("formats signed percentages with a real minus sign", () => {
  expect(signedPercent(-0.0123)).toBe("−1,2 %")
  expect(signedPercent(0.05)).toBe("+5,0 %")
})
