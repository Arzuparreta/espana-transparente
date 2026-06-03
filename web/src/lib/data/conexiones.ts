import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"

const INDICATOR_PAGE_SIZE = 1000

const REVOLVING_DOOR_PUBLIC_COLS =
  "id, person_name, political_party, public_role, public_organization, public_exit_date, private_role, private_organization, private_start_date, authorization_date, cooling_off_months, sector, person_id, organization_id, primary_source_url, source_url, sources"

type IndicatorRow = {
  indicator_code: string
  indicator_name: string
  unit: string | null
  period: string
  value: number
}

export const getRevolvingDoorCases = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_revolving_door_public")
      .select(REVOLVING_DOOR_PUBLIC_COLS)
      .order("person_name")
    return data ?? []
  },
  ["revolving-door-cases"],
  { revalidate: HOUR }
)

export const getRevolvingDoorCaseById = unstable_cache(
  async (id: string) => {
    const { data } = await supabase
      .from("v_revolving_door_public")
      .select(REVOLVING_DOOR_PUBLIC_COLS)
      .eq("id", id)
      .maybeSingle()
    return data ?? null
  },
  ["revolving-door-case-by-id"],
  { revalidate: HOUR }
)

export const getIndicators = unstable_cache(
  async () => {
    const rows: IndicatorRow[] = []
    let from = 0

    while (true) {
      const { data } = await supabase
        .from("economic_indicators")
        .select("indicator_code, indicator_name, unit, period, value")
        .order("indicator_code")
        .order("period", { ascending: false })
        .range(from, from + INDICATOR_PAGE_SIZE - 1)

      const page = data ?? []
      rows.push(...(page as IndicatorRow[]))
      if (page.length < INDICATOR_PAGE_SIZE) break
      from += INDICATOR_PAGE_SIZE
    }

    return rows
  },
  ["indicators"],
  { revalidate: HOUR }
)

export const getIndicatorSectionFacts = unstable_cache(
  async () => {
    const rows = await getIndicators()

    const codes = new Set<string>()
    for (const row of rows) {
      const code = row.indicator_code as string | null
      const value = Number(row.value)
      if (code && Number.isFinite(value)) {
        codes.add(code)
      }
    }

    return {
      section_key: "indicadores",
      record_count: codes.size,
      latest_date: null,
    }
  },
  ["indicator-section-facts"],
  { revalidate: HOUR }
)

export const getIndicatorPoints = unstable_cache(
  async (code: string) => {
    const { data } = await supabase
      .from("economic_indicators")
      .select("period, value, unit, indicator_name")
      .eq("indicator_code", code)
      .order("period", { ascending: false })
      .limit(120)
    return data ?? []
  },
  ["indicator-points"],
  { revalidate: HOUR }
)

export type InitiativeListRow = {
  id: string
  type: string | null
  number: string | null
  title: string | null
  proposer_group: string | null
  status: string | null
  source_url: string | null
}

export const getInitiativesPage = unstable_cache(
  async (page: number) => {
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data, count } = await supabase
      .from("initiatives")
      .select("id, type, number, title, proposer_group, status, source_url", { count: "exact" })
      .order("number", { ascending: false, nullsFirst: false })
      .range(from, to)
    return {
      initiatives: (data ?? []) as InitiativeListRow[],
      total: count ?? 0,
    }
  },
  ["initiatives-page"],
  { revalidate: HOUR }
)

export const getInitiativeDetail = unstable_cache(
  async (id: string) => {
    const { data: initiative } = await supabase
      .from("initiatives")
      .select("id, type, number, title, proposer_group, status, source_url, legislature_id")
      .eq("id", id)
      .single()

    if (!initiative) return { initiative: null, sessions: [] }

    const { data: sessions } = await supabase
      .from("v_voting_session_summary")
      .select("id, title, date, votes_yes, votes_no, votes_abstain, votes_no_vote, divergence_count")
      .eq("initiative_number", initiative.number)
      .order("date", { ascending: false })

    return { initiative, sessions: sessions ?? [] }
  },
  ["initiative-detail"],
  { revalidate: HOUR }
)
