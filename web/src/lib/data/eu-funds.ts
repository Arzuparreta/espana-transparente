import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE, type EuFundRow, type EuFundsSummary } from "./shared"

export type { EuFundRow, EuFundsSummary }

export const getEuFundsPage = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * PAGE_SIZE.euFunds
    const to = from + PAGE_SIZE.euFunds - 1
    const { data, count } = await supabase
      .from("eu_funds")
      .select("id, label, eu_budget, total_budget, cofinancing_rate, number_projects, wikidata_link", { count: "exact" })
      .order("eu_budget", { ascending: false, nullsFirst: false })
      .range(from, to)
    return { funds: (data ?? []) as EuFundRow[], total: count ?? 0 }
  },
  ["eu-funds-page"],
  { revalidate: HOUR * 24 }
)

export const getEuFundsSummary = unstable_cache(
  async () => {
    const { data } = await supabase.from("v_eu_funds_summary").select("*").single()
    return (data ?? null) as EuFundsSummary | null
  },
  ["eu-funds-summary"],
  { revalidate: HOUR * 24 }
)

export const getEuFundBySlug = unstable_cache(
  async (slug: string) => {
    const { data } = await supabase
      .from("eu_funds")
      .select("id, label, eu_budget, total_budget, cofinancing_rate, number_projects, wikidata_link, country_code")
      .like("id", `%/${slug}`)
      .limit(1)
      .maybeSingle()
    return (data ?? null) as (EuFundRow & { country_code: string | null }) | null
  },
  ["eu-fund-by-slug"],
  { revalidate: HOUR * 24 }
)
