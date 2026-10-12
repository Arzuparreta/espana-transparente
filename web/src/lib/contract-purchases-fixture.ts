import type { PurchaseCoverage, PurchaseRow } from "./contract-purchases"

export const coverage: PurchaseCoverage = {
  refreshed_at: "2026-10-13T05:00:00Z", source_rows: 10, annulled_excluded: 1, superseded_legacy_excluded: 0,
  without_award_evidence: 2, invalid_award_date: 3, latest_award_date: "2026-10-09", years: [2024, 2025, 2026],
}
export const row = (over: Partial<PurchaseRow>): PurchaseRow => ({
  award_year: 2025, administration_level: "state", cpv_division: "45", expedientes: 1, expedientes_verified: 0,
  budget_eur: "100.00", budget_missing: 0, results: 1, results_legacy: 1, results_one_offer: 1,
  results_two_to_four: 0, results_five_plus: 0, results_offers_unknown: 0, ...over,
})
