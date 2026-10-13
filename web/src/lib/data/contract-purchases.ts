import { supabase } from "@/lib/supabase/public"
import { unstable_cache, HOUR, dataQuerySignal, dataErrorMessage } from "./shared"
import {
  selectPurchaseYear,
  validatePurchaseCoverage,
  type PurchaseCoverage,
  type PurchaseRow,
} from "@/lib/contract-purchases"

export type ContractPurchases = {
  coverage: PurchaseCoverage | null
  year: number | null
  rows: PurchaseRow[]
  error: boolean
}

const cachedContractPurchases = unstable_cache(
  async (requested?: string): Promise<ContractPurchases> => {
    const coverageResult = await supabase
      .from("contract_purchase_coverage")
      .select("refreshed_at,source_rows,annulled_excluded,superseded_legacy_excluded,without_award_evidence,invalid_award_date,latest_award_date,years")
      .eq("scope", "pcsp-643")
      .abortSignal(dataQuerySignal())
      .maybeSingle()
    if (coverageResult.error) throw coverageResult.error
    const coverage = validatePurchaseCoverage(coverageResult.data)
    const year = selectPurchaseYear(coverage, requested)
    if (!coverage || year === null) return { coverage, year, rows: [], error: false }
    const result = await supabase
      .from("contract_purchase_summary")
      .select("*")
      .eq("award_year", year)
      .limit(1000)
      .abortSignal(dataQuerySignal())
    if (result.error) throw result.error
    const rows = (result.data ?? []) as PurchaseRow[]
    // At most 4 levels × 46 divisions; a truncated read would misstate every total.
    if (rows.length >= 1000) throw new Error("Contract purchase summary larger than expected")
    return { coverage, year, rows, error: false }
  },
  ["contract-purchases-v1"],
  { revalidate: HOUR },
)

// Keep failures outside the cache: a transient failure must be retryable.
export async function getContractPurchases(requested?: string | string[]): Promise<ContractPurchases> {
  try {
    return await cachedContractPurchases(Array.isArray(requested) ? requested[0] : requested)
  } catch (error) {
    console.error("Contract purchases", dataErrorMessage(error))
    return { coverage: null, year: null, rows: [], error: true }
  }
}
