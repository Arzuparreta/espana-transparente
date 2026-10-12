import { expect, it } from "vitest"
import {
  executionPeriods,
  executionRatio,
  selectExecutionPeriod,
} from "./budget-execution"
import { executionFixture } from "./budget-execution-fixtures"
it("reconciles chapters without double counting published totals", () => {
  const data = executionPeriods(executionFixture())
  expect(data.periods[0].rows.NF.credit).toBe(70)
  expect(data.periods[0].rows.TOTAL.credit).toBe(90)
  expect(selectExecutionPeriod(data.periods, "2026-12")).toBeUndefined()
  expect(selectExecutionPeriod(data.periods, ["2025-12"])).toBeUndefined()
})
it("keeps unknown, zero and zero denominators distinct", () => {
  expect(executionRatio(null, 10)).toBeNull()
  expect(executionRatio(0, 0)).toBeNull()
  expect(executionRatio(0, 10)).toBe(0)
})
it.each(["sum", "unit", "duplicate", "hash", "missing", "basis"])(
  "rejects %s without publishing a partial result",
  (issue) => {
    const rows = executionFixture()
    if (issue === "sum") rows[0].credit = 20
    if (issue === "unit") rows[0].unit = "EUR"
    if (issue === "duplicate") rows[0].chapter = "2"
    if (issue === "hash") rows[0].raw_data!.workbook_sha256 = "b".repeat(64)
    if (issue === "missing") rows.pop()
    if (issue === "basis")
      rows[0].raw_data!.payment_basis = "current_and_closed"
    expect(executionPeriods(rows)).toEqual({
      periods: [],
      rejectedPeriods: ["2025-12"],
    })
  },
)
