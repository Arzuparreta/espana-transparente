import { supabase } from "@/lib/supabase/client"
import {
  dataErrorMessage,
  dataQuerySignal,
  unstable_cache,
  HOUR,
  type MoneyCoverageRow,
  type UnresolvedMoneyExampleRow,
} from "./shared"

const getMoneyDataOverviewCached = unstable_cache(
  async () => {
    const [coverage, examples] = await Promise.all([
      supabase
        .from("v_money_data_public")
        .select("dataset, administration_level, freshness_window, total_rows, resolved_rows, unresolved_rows, conflict_rows, coverage_start_date, latest_record_date")
        .order("dataset")
        .order("administration_level")
        .abortSignal(dataQuerySignal()),
      supabase
        .from("v_unresolved_money_examples")
        .select("dataset, record_id, record_date, body_name, body_normalized, administration_level, display_title, source_url, issue_type")
        .order("record_date", { ascending: false })
        .limit(18)
        .abortSignal(dataQuerySignal()),
    ])

    if (coverage.error || examples.error) {
      console.error("getMoneyDataOverview error:", dataErrorMessage(coverage.error ?? examples.error))
      throw new Error("Money data overview source unavailable")
    }

    return {
      coverage: (coverage.data ?? []) as MoneyCoverageRow[],
      examples: (examples.data ?? []) as UnresolvedMoneyExampleRow[],
    }
  },
  ["money-data-overview"],
  { revalidate: HOUR }
)

export async function getMoneyDataOverview() {
  try {
    const result = await getMoneyDataOverviewCached()
    return { status: "ok" as const, ...result }
  } catch (error) {
    console.error("getMoneyDataOverview unavailable:", dataErrorMessage(error))
    return {
      status: "unavailable" as const,
      coverage: [] as MoneyCoverageRow[],
      examples: [] as UnresolvedMoneyExampleRow[],
    }
  }
}

export const getMoneyDatasetSummary = unstable_cache(
  async (dataset: "contracts" | "subsidies") => {
    const { data } = await supabase
      .from("v_money_data_public")
      .select("dataset, administration_level, freshness_window, total_rows, resolved_rows, unresolved_rows, conflict_rows, coverage_start_date, latest_record_date")
      .eq("dataset", dataset)
      .order("administration_level")

    const rows = (data ?? []) as MoneyCoverageRow[]
    const total = rows.reduce(
      (acc, row) => {
        acc.total_rows += row.total_rows
        acc.resolved_rows += row.resolved_rows
        acc.unresolved_rows += row.unresolved_rows
        acc.conflict_rows += row.conflict_rows
        if (!acc.coverage_start_date || (row.coverage_start_date && row.coverage_start_date < acc.coverage_start_date))
          acc.coverage_start_date = row.coverage_start_date
        if (!acc.latest_record_date || (row.latest_record_date && row.latest_record_date > acc.latest_record_date))
          acc.latest_record_date = row.latest_record_date
        return acc
      },
      { total_rows: 0, resolved_rows: 0, unresolved_rows: 0, conflict_rows: 0, coverage_start_date: null as string | null, latest_record_date: null as string | null }
    )

    return { rows, total }
  },
  ["money-dataset-summary"],
  { revalidate: HOUR }
)
