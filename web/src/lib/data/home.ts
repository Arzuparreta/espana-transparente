import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PHOTOS_CACHE_VERSION, type TopContractAncla, type TopDivergenceSessionAncla, type InflationAnchor } from "./shared"

export type { TopContractAncla, TopDivergenceSessionAncla, InflationAnchor }

export const getHomeData = unstable_cache(
  async () => {
    const currentBudgetYear = new Date().getFullYear()

    const [
      politicians,
      politicianCount,
      parties,
      contractCount,
      subsidyCount,
      budgetSummaryRows,
      recentSessions,
      sessionCount,
      revolvingDoorCases,
      gobierno,
      deudaPublica,
    ] = await Promise.all([
      supabase
        .from("politicians")
        .select(
          "id, first_name, last_name, full_name, photo_url, photo_variants, politician_memberships!inner(id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name))"
        )
        .eq("politician_memberships.is_active", true)
        .eq("politician_memberships.chamber", "congress")
        .order("full_name")
        .limit(12),
      supabase
        .from("politician_memberships")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("chamber", "congress"),
      supabase.from("parties").select("acronym, color, name").order("acronym"),
      supabase.from("contracts").select("*", { count: "exact", head: true }),
      supabase.from("subsidies").select("*", { count: "exact", head: true }),
      supabase
        .from("v_budget_summary")
        .select("year, budget_type, total_credit_initial")
        .eq("year", currentBudgetYear),
      supabase
        .from("v_voting_session_summary")
        .select("id, date, title, total_votes, votes_yes, votes_no, divergence_count")
        .order("date", { ascending: false })
        .limit(5),
      supabase.from("voting_sessions").select("*", { count: "exact", head: true }),
      supabase
        .from("v_revolving_door_public")
        .select("id, person_name, public_role, private_organization, sector, person_id")
        .order("id", { ascending: false })
        .limit(4),
      supabase
        .from("v_gobierno_actual")
        .select("id, person_name, organization_name, political_party, party_color, politician_id, position_type")
        .in("position_type", ["presidente_gobierno", "vicepresidente"])
        .limit(6),
      supabase
        .from("economic_indicators")
        .select("period, value, unit")
        .eq("indicator_code", "DEUDA_PUBLICA")
        .order("period", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const budgetTotal = (budgetSummaryRows.data ?? []).reduce(
      (sum, r) => sum + ((r.total_credit_initial as number) ?? 0),
      0
    )
    const currentBudgetType =
      budgetSummaryRows.data?.[0]?.budget_type != null
        ? String(budgetSummaryRows.data[0].budget_type)
        : null

    const deudaRow = deudaPublica.data
    const POBLACION_ESPANA = 47_400_000
    const deudaPerCapita =
      deudaRow?.value != null
        ? Math.round((deudaRow.value as number) * 1_000_000 / POBLACION_ESPANA)
        : null
    const deudaYear = deudaRow?.period ? String(deudaRow.period).slice(0, 4) : null

    return {
      politicians: politicians.data ?? [],
      politicianCount: politicianCount.count ?? 0,
      parties: parties.data ?? [],
      contractCount: contractCount.count ?? 0,
      subsidyCount: subsidyCount.count ?? 0,
      sessionCount: sessionCount.count ?? 0,
      currentBudget:
        budgetTotal > 0
          ? { year: currentBudgetYear, total: budgetTotal, budgetType: currentBudgetType }
          : null,
      recentSessions: recentSessions.data ?? [],
      revolvingDoorCases: revolvingDoorCases.data ?? [],
      gobierno: gobierno.data ?? [],
      deudaPerCapita,
      deudaYear,
    }
  },
  ["home-data", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

export const getTopContractOfMonth = unstable_cache(
  async (): Promise<TopContractAncla | null> => {
    const windows: Array<30 | 60 | 90> = [30, 60, 90]
    for (const days of windows) {
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from("contracts")
        .select("id, title, amount, awarding_body, contractor, date")
        .gte("date", from)
        .order("amount", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (data) return { ...(data as Omit<TopContractAncla, "windowDays">), windowDays: days }
    }
    const { data } = await supabase
      .from("contracts")
      .select("id, title, amount, awarding_body, contractor, date")
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    return data ? { ...(data as Omit<TopContractAncla, "windowDays">), windowDays: null } : null
  },
  ["top-contract-of-month"],
  { revalidate: HOUR }
)

export const getTopDivergenceSessionOfMonth = unstable_cache(
  async (): Promise<TopDivergenceSessionAncla | null> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const recent = await supabase
      .from("v_voting_session_summary")
      .select("id, title, date, divergence_count")
      .gte("date", thirtyDaysAgo)
      .gt("divergence_count", 0)
      .order("divergence_count", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent.data) {
      return { ...(recent.data as Omit<TopDivergenceSessionAncla, "isRecent">), isRecent: true }
    }
    const allTime = await supabase
      .from("v_voting_session_summary")
      .select("id, title, date, divergence_count")
      .gt("divergence_count", 0)
      .order("divergence_count", { ascending: false })
      .limit(1)
      .maybeSingle()
    return allTime.data
      ? { ...(allTime.data as Omit<TopDivergenceSessionAncla, "isRecent">), isRecent: false }
      : null
  },
  ["top-divergence-session-of-month"],
  { revalidate: HOUR }
)

export const getLatestInflationAnchor = unstable_cache(
  async (): Promise<InflationAnchor | null> => {
    const monthly = await supabase
      .from("economic_indicators")
      .select("period, value, raw_data")
      .eq("indicator_code", "IPC_VAR_MENSUAL")
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (monthly.data?.value == null || monthly.data.period == null) return null

    const annual = await supabase
      .from("economic_indicators")
      .select("period, value")
      .eq("indicator_code", "IPC_VAR_ANUAL")
      .eq("period", monthly.data.period as string)
      .limit(1)
      .maybeSingle()

    const rawData = monthly.data.raw_data as { point?: { T3_TipoDato?: string | null } } | null | undefined

    return {
      period: monthly.data.period as string,
      monthlyValue: Number(monthly.data.value),
      annualValue: annual.data?.value != null ? Number(annual.data.value) : null,
      dataType: rawData?.point?.T3_TipoDato ?? null,
    }
  },
  ["latest-inflation-anchor"],
  { revalidate: HOUR }
)
