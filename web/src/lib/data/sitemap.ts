import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"

// Caps keep the sitemap under Google's per-file limit (50K URLs).
// For very large tables we use ranked subsets ordered by a high-signal field.
const SITEMAP_CAPS = {
  votingSessions: 5000,
  contracts: 5000,
  subsidies: 5000,
  euFunds: 5000,
  organizations: 5000,
  initiatives: 3000,
  budgetPrograms: 5000,
  judicialCases: 3000,
} as const

const DAY = HOUR * 24

export const getSitemapVotingSessionIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("voting_sessions")
      .select("id, date")
      .order("date", { ascending: false, nullsFirst: false })
      .limit(SITEMAP_CAPS.votingSessions)
    return (data ?? []) as { id: string; date: string | null }[]
  },
  ["sitemap-voting-sessions"],
  { revalidate: DAY }
)

export const getSitemapContractIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("contracts")
      .select("id, date")
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(SITEMAP_CAPS.contracts)
    return (data ?? []) as { id: string; date: string | null }[]
  },
  ["sitemap-contracts"],
  { revalidate: DAY }
)

export const getSitemapSubsidyIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("subsidies")
      .select("id, fecha_concesion")
      .order("importe", { ascending: false, nullsFirst: false })
      .limit(SITEMAP_CAPS.subsidies)
    return (data ?? []).map((r) => ({
      id: r.id as string,
      date: (r.fecha_concesion as string | null) ?? null,
    }))
  },
  ["sitemap-subsidies"],
  { revalidate: DAY }
)

export const getSitemapEuFundSlugs = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("eu_funds")
      .select("id")
      .order("eu_budget", { ascending: false, nullsFirst: false })
      .limit(SITEMAP_CAPS.euFunds)
    return (data ?? [])
      .map((r) => {
        const id = r.id as string
        const slug = id.split("/").at(-1)
        return slug ? { slug } : null
      })
      .filter((x): x is { slug: string } => Boolean(x))
  },
  ["sitemap-eu-funds"],
  { revalidate: DAY }
)

export const getSitemapRevolvingDoorIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_revolving_door_public")
      .select("id")
      .order("id", { ascending: false })
    return (data ?? []).map((r) => ({ id: r.id as string }))
  },
  ["sitemap-revolving-door"],
  { revalidate: DAY }
)

export const getSitemapJudicialCaseIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_corruption_cases_public")
      .select("id, source_published_at")
      .order("source_published_at", { ascending: false, nullsFirst: false })
      .limit(SITEMAP_CAPS.judicialCases)
    return (data ?? []).map((r) => ({
      id: r.id as string,
      date: (r.source_published_at as string | null) ?? null,
    }))
  },
  ["sitemap-judicial-cases"],
  { revalidate: DAY }
)

export const getSitemapOrganizationIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_organization_public")
      .select("id, contract_count, subsidy_beneficiary_count")
      .order("contract_count", { ascending: false, nullsFirst: false })
      .limit(SITEMAP_CAPS.organizations)
    return (data ?? []).map((r) => ({ id: r.id as string }))
  },
  ["sitemap-organizations"],
  { revalidate: DAY }
)

export const getSitemapIndicatorCodes = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("economic_indicators")
      .select("indicator_code")
      .order("indicator_code")
    const seen = new Set<string>()
    for (const row of data ?? []) {
      const code = (row.indicator_code as string | null) ?? null
      if (code) seen.add(code)
    }
    return Array.from(seen).map((code) => ({ code }))
  },
  ["sitemap-indicator-codes"],
  { revalidate: DAY }
)

export const getSitemapInstitucionIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_instituciones_actuales")
      .select("id")
      .order("appointment_date", { ascending: false, nullsFirst: false })
    return (data ?? []).map((r) => ({ id: r.id as string }))
  },
  ["sitemap-instituciones"],
  { revalidate: DAY }
)

export const getSitemapBudgetSectionPaths = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_budget_summary")
      .select("year, section_code")
    const seen = new Set<string>()
    const out: { year: number; section_code: string }[] = []
    for (const row of data ?? []) {
      const year = row.year as number | null
      const section = row.section_code as string | null
      if (year == null || !section) continue
      const key = `${year}/${section}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ year, section_code: section })
    }
    return out
  },
  ["sitemap-budget-sections"],
  { revalidate: DAY }
)

export const getSitemapBudgetProgramPaths = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_budget_by_program")
      .select("section_code, program_code, total_credit_initial")
      .order("total_credit_initial", { ascending: false, nullsFirst: false })
      .limit(SITEMAP_CAPS.budgetPrograms)
    const seen = new Set<string>()
    const out: { section_code: string; program_code: string }[] = []
    for (const row of data ?? []) {
      const section = row.section_code as string | null
      const program = row.program_code as string | null
      if (!section || !program) continue
      const key = `${section}/${program}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ section_code: section, program_code: program })
    }
    return out
  },
  ["sitemap-budget-programs"],
  { revalidate: DAY }
)

export const getSitemapInitiativeIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("initiatives")
      .select("id")
      .order("id", { ascending: false })
      .limit(SITEMAP_CAPS.initiatives)
    return (data ?? []).map((r) => ({ id: r.id as string }))
  },
  ["sitemap-initiatives"],
  { revalidate: DAY }
)

export const getSitemapGobiernoIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_gobierno_actual")
      .select("id")
      .in("position_type", ["vicepresidente", "ministro"])
    return (data ?? []).map((r) => ({ id: r.id as string }))
  },
  ["sitemap-gobierno"],
  { revalidate: DAY }
)

export const getSitemapSenatorIds = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("politicians")
      .select("id, politician_memberships!inner(id)")
      .eq("politician_memberships.is_active", true)
      .eq("politician_memberships.chamber", "senate")
    return (data ?? []).map((r) => ({ id: r.id as string }))
  },
  ["sitemap-senators"],
  { revalidate: DAY }
)
