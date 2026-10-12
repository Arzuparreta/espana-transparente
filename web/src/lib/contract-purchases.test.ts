import { describe, expect, it } from "vitest"
import { CPV_DIVISIONS, divisionLabel, selectPurchaseLevel, selectPurchaseYear, share, summarizePurchases } from "./contract-purchases"
import { coverage, row } from "./contract-purchases-fixture"

const now = new Date("2026-10-13T00:00:00Z")

describe("contract purchases", () => {
  it("has the 45 official CPV divisions and labels unknown codes without inventing a name", () => {
    expect(Object.keys(CPV_DIVISIONS)).toHaveLength(45)
    expect(divisionLabel("45")).toBe("Trabajos de construcción")
    expect(divisionLabel("none")).toBe("Sin código CPV publicado")
    expect(divisionLabel("99")).toBe("División CPV 99")
  })

  it("defaults to the latest complete year and never substitutes an invalid request", () => {
    expect(selectPurchaseYear(coverage, undefined, now)).toBe(2025)
    expect(selectPurchaseYear(coverage, "2026", now)).toBe(2026)
    expect(selectPurchaseYear(coverage, "2019", now)).toBeNull()
    expect(selectPurchaseYear(coverage, "abc", now)).toBeNull()
    expect(selectPurchaseYear({ ...coverage, years: [2026] }, undefined, now)).toBe(2026)
    expect(selectPurchaseYear({ ...coverage, years: [] }, undefined, now)).toBeNull()
    expect(selectPurchaseYear(null, undefined, now)).toBeNull()
  })

  it("distinguishes all levels, a valid level and an invalid one", () => {
    expect(selectPurchaseLevel(undefined)).toBeNull()
    expect(selectPurchaseLevel("all")).toBeNull()
    expect(selectPurchaseLevel("municipal")).toBe("municipal")
    expect(selectPurchaseLevel("toString")).toBeUndefined()
    expect(selectPurchaseLevel("nope")).toBeUndefined()
  })

  it("adds rows of the selected year and level only, keeping budgets, results and offer buckets reconciled", () => {
    const rows = [
      row({}),
      row({ administration_level: "municipal", cpv_division: "72", budget_eur: 50, results: 3, results_legacy: 0, results_one_offer: 0, results_two_to_four: 1, results_five_plus: 1, results_offers_unknown: 1, expedientes_verified: 1 }),
      row({ award_year: 2024, budget_eur: 9999 }),
    ]
    const all = summarizePurchases(rows, 2025, null, now)
    expect(all).toMatchObject({ expedientes: 2, verified: 1, budget: 150, results: 4, legacyResults: 1, oneOffer: 1, twoToFour: 1, fivePlus: 1, offersUnknown: 1, partialYear: false })
    expect(all.divisions.map((d) => d.division)).toEqual(["45", "72"])
    expect(all.divisions[1]).toMatchObject({ withOffers: 2, oneOffer: 0 })
    expect(summarizePurchases(rows, 2025, "municipal", now)).toMatchObject({ expedientes: 1, budget: 50 })
    expect(summarizePurchases(rows, 2026, null, now)).toMatchObject({ expedientes: 0, partialYear: true })
  })

  it("does not compute a share without denominator", () => {
    expect(share(0, 0)).toBe("sin dato")
    expect(share(1, 4)).toBe("25 %")
  })
})
