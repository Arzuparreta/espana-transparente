import { describe, expect, it } from "vitest"
import {
  budgetEditionUrl,
  budgetYearSelection,
  publishedBudgetTotal,
} from "./budget-context"
describe("budget editions and amounts", () => {
  it("does not sum historical references as current published credits", () => {
    expect(
      publishedBudgetTotal([
        { source_kind: "published_prorroga", total_credit_initial: 100 },
        { source_kind: "carried_forward", total_credit_initial: 300 },
      ]),
    ).toBe(100)
    expect(
      publishedBudgetTotal([
        { source_kind: "carried_forward", total_credit_initial: 300 },
      ]),
    ).toBeNull()
    expect(
      publishedBudgetTotal([
        { source_kind: "published_prorroga", total_credit_initial: null },
      ]),
    ).toBeNull()
    expect(
      publishedBudgetTotal([
        { source_kind: "published", total_credit_initial: 0 },
      ]),
    ).toBe(0)
  })
  it("links the official exercise, not the year in its folder name", () => {
    expect(budgetEditionUrl(2024)).toContain("PGE2023Prorroga/")
    expect(budgetEditionUrl(2025)).toContain("PGE2024Prorroga/")
    expect(budgetEditionUrl(2026)).toContain("PGE2025Prorroga/")
    expect(budgetEditionUrl(2023)).toContain("Ejercicio2023.aspx")
  })
  it("keeps supported single years and rejects malformed or unavailable selections", () => {
    expect(budgetYearSelection(undefined, [2023, 2024])).toBe(2024)
    expect(budgetYearSelection("2023", [2023, 2024])).toBe(2023)
    for (const value of ["2023foo", "2020", ["2023", "2024"], ""])
      expect(budgetYearSelection(value, [2023, 2024])).toBeNull()
  })
})
