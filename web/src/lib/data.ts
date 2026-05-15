import { unstable_cache } from "next/cache"
import { supabase } from "@/lib/supabase/client"

const HOUR = 3600

export const PAGE_SIZE = {
  votingSessions: 30,
  contracts: 50,
}

export function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number.parseInt(raw ?? "1", 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export const getHomeData = unstable_cache(
  async () => {
    const [politicians, politicianCount, parties, sessionsCount] = await Promise.all([
      supabase
        .from("politicians")
        .select(
          "id, first_name, last_name, full_name, photo_url, photo_variants, politician_memberships!inner(id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name))"
        )
        .eq("politician_memberships.is_active", true)
        .order("full_name")
        .limit(24),
      supabase.from("politicians").select("*", { count: "exact", head: true }),
      supabase.from("parties").select("acronym, color, name").order("acronym"),
      supabase.from("voting_sessions").select("*", { count: "exact", head: true }),
    ])

    return {
      politicians: politicians.data ?? [],
      politicianCount: politicianCount.count ?? 0,
      parties: parties.data ?? [],
      sessionsCount: sessionsCount.count ?? 0,
    }
  },
  ["home-data"],
  { revalidate: HOUR }
)

export const getDeputyCards = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("politicians")
      .select(
        "id, first_name, last_name, full_name, photo_url, photo_variants, politician_memberships!inner(id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name))"
      )
      .eq("politician_memberships.is_active", true)
      .order("full_name")

    return data ?? []
  },
  ["deputy-cards"],
  { revalidate: HOUR }
)

export const getParties = unstable_cache(
  async () => {
    const { data } = await supabase.from("parties").select("*").order("acronym")
    return data ?? []
  },
  ["parties"],
  { revalidate: HOUR }
)

export const getPartyPageData = unstable_cache(
  async (id: string) => {
    const [party, memberships] = await Promise.all([
      supabase.from("parties").select("*").eq("id", id).single(),
      supabase
        .from("politician_memberships")
        .select(
          "id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name), politician:politicians(id, first_name, last_name, full_name, photo_url, photo_variants)"
        )
        .eq("party_id", id)
        .eq("is_active", true)
        .order("constituency"),
    ])

    return {
      party: party.data,
      memberships: memberships.data ?? [],
    }
  },
  ["party-page-data"],
  { revalidate: HOUR }
)

export const getVotingSessionPage = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * PAGE_SIZE.votingSessions
    const to = from + PAGE_SIZE.votingSessions - 1
    const { data, count, error } = await supabase
      .from("v_voting_session_summary")
      .select(
        "id, title, session_number, date, initiative_number, votacion_number, vote_count, divergence_count",
        { count: "exact" }
      )
      .order("date", { ascending: false })
      .order("session_number", { ascending: false })
      .order("votacion_number", { ascending: true })
      .range(from, to)

    if (!error) {
      return { sessions: data ?? [], total: count ?? 0 }
    }

    const fallback = await supabase
      .from("voting_sessions")
      .select("id, title, session_number, date, initiative_number, votes(count)", {
        count: "exact",
      })
      .order("date", { ascending: false })
      .range(from, to)

    return { sessions: fallback.data ?? [], total: fallback.count ?? 0 }
  },
  ["voting-session-page"],
  { revalidate: HOUR }
)

export const getVotingDetailData = unstable_cache(
  async (id: string) => {
    const [session, votes] = await Promise.all([
      supabase.from("voting_sessions").select("*").eq("id", id).single(),
      supabase
        .from("votes")
        .select(
          "vote, politician:politicians(full_name), membership:politician_memberships!inner(party:parties(acronym, color))"
        )
        .eq("voting_session_id", id)
        .eq("membership.is_active", true),
    ])

    return {
      session: session.data,
      votes: votes.data ?? [],
    }
  },
  ["voting-detail-data"],
  { revalidate: HOUR }
)

export const getPoliticianProfileData = unstable_cache(
  async (id: string) => {
    const [pol, votes, totalVotes, powerRels, revolvingDoors, attendance] =
      await Promise.all([
        supabase
          .from("politicians")
          .select(
            "*, politician_memberships(*, party:parties(*), legislature:legislatures(*)), economic_declarations(*)"
          )
          .eq("id", id)
          .single(),
        supabase
          .from("votes")
          .select("vote, voting_sessions!inner(date, title, initiative_number)")
          .eq("politician_id", id)
          .order("date", { ascending: false, foreignTable: "voting_sessions" })
          .limit(30),
        supabase
          .from("votes")
          .select("*", { count: "exact", head: true })
          .eq("politician_id", id),
        supabase
          .from("power_relationships")
          .select("*, superior:superior_id(full_name), party:parties(acronym, color)")
          .eq("person_id", id),
        supabase.from("v_revolving_door_public").select("*").eq("person_id", id),
        supabase
          .from("v_attendance_summary")
          .select("total_sessions, sessions_present, attendance_pct")
          .eq("politician_id", id)
          .maybeSingle(),
      ])

    let legacyRevolvingDoors = null
    if (revolvingDoors.error) {
      legacyRevolvingDoors = await supabase
        .from("revolving_door")
        .select("*")
        .eq("person_id", id)
    }

    return {
      pol: pol.data,
      votes: votes.data ?? [],
      totalVotes: totalVotes.count,
      powerRels: powerRels.data ?? [],
      revolvingDoors: revolvingDoors.data ?? legacyRevolvingDoors?.data ?? [],
      attendance: attendance.data,
    }
  },
  ["politician-profile-data"],
  { revalidate: HOUR }
)

export const getIndicators = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("economic_indicators")
      .select("indicator_code, indicator_name, unit, period, value")
      .order("indicator_code")
      .order("period", { ascending: false })

    return data ?? []
  },
  ["indicators"],
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

export const PAGE_SIZE_SUBSIDIES = 50

type Responsibility = {
  person_name: string | null
  politician_id: string | null
  ministry: string | null
  government: string | null
  political_party: string | null
  administration_level?: string | null
  territory_name?: string | null
  match_method?: string | null
}

type SubsidyResponsibilityRow = Responsibility & {
  subsidy_id: string
}

type ContractResponsibilityRow = Responsibility & {
  contract_id: string
}

type OrganizationPublicRow = {
  id: string
  name: string
  organization_type: string | null
  sector: string | null
  country: string | null
  source_url: string | null
  contract_count: number
  subsidy_beneficiary_count: number
  subsidy_granting_count: number
  revolving_door_count: number
}

type MoneyCoverageRow = {
  dataset: string
  administration_level: string
  freshness_window: string
  total_rows: number
  resolved_rows: number
  unresolved_rows: number
  conflict_rows: number
  coverage_start_date: string | null
  latest_record_date: string | null
}

type UnresolvedMoneyExampleRow = {
  dataset: string
  record_id: string
  record_date: string | null
  body_name: string | null
  body_normalized: string | null
  administration_level: string | null
  display_title: string | null
  source_url: string | null
  issue_type: "unresolved" | "conflict"
}

export const getSubvencionPage = unstable_cache(
  async (page: number, nivel1: string) => {
    const from = (page - 1) * PAGE_SIZE_SUBSIDIES
    const to = from + PAGE_SIZE_SUBSIDIES - 1

    let query = supabase
      .from("subsidies")
      .select(
        "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url",
        { count: "exact" }
      )
      .order("importe", { ascending: false, nullsFirst: false })

    if (nivel1 !== "all") {
      query = query.eq("nivel1", nivel1)
    }

    const { data, count } = await query.range(from, to)
    const subsidyIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      subsidyIds.length > 0
        ? await supabase
            .from("v_subsidy_responsibility")
            .select(
              "subsidy_id, person_name, politician_id, ministry, government, political_party, administration_level, territory_name, match_method"
            )
            .in("subsidy_id", subsidyIds)
        : { data: [] }

    const responsibleBySubsidy = new Map(
      ((responsibilities.data ?? []) as SubsidyResponsibilityRow[]).map((row) => [
        row.subsidy_id,
        {
          person_name: row.person_name,
          politician_id: row.politician_id,
          ministry: row.ministry,
          government: row.government,
          political_party: row.political_party,
          administration_level: row.administration_level,
          territory_name: row.territory_name,
          match_method: row.match_method,
        },
      ])
    )

    const stats = await supabase
      .from("subsidies")
      .select("id, nivel1, importe")
      .limit(2000)

    return {
      subsidies: (data ?? []).map((row) => ({
        ...row,
        responsible: responsibleBySubsidy.get(row.id) ?? null,
      })),
      total: count ?? 0,
      statsRows: stats.data ?? [],
    }
  },
  ["subsidies-page"],
  { revalidate: HOUR }
)

export const getContractPage = unstable_cache(
  async (page: number, type: string) => {
    const from = (page - 1) * PAGE_SIZE.contracts
    const to = from + PAGE_SIZE.contracts - 1
    let query = supabase
      .from("contracts")
      .select(
        "id, contract_folder_id, title, awarding_body, awarding_body_organization_id, amount, status, contract_type, region, date, source_url",
        { count: "exact" }
      )
      .order("amount", { ascending: false, nullsFirst: false })

    if (type !== "all") {
      query = query.eq("contract_type", type)
    }

    const { data, count } = await query.range(from, to)
    const contractIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      contractIds.length > 0
        ? await supabase
            .from("v_contract_responsibility")
            .select(
              "contract_id, person_name, politician_id, ministry, government, political_party, administration_level, territory_name, match_method"
            )
            .in("contract_id", contractIds)
        : { data: [] }

    const responsibleByContract = new Map(
      ((responsibilities.data ?? []) as ContractResponsibilityRow[]).map((row) => [
        row.contract_id,
        {
          person_name: row.person_name,
          politician_id: row.politician_id,
          ministry: row.ministry,
          government: row.government,
          political_party: row.political_party,
          administration_level: row.administration_level,
          territory_name: row.territory_name,
          match_method: row.match_method,
        },
      ])
    )

    const stats = await supabase
      .from("contracts")
      .select("id, awarding_body, amount")
      .limit(1000)

    return {
      contracts: (data ?? []).map((row) => ({
        ...row,
        responsible: responsibleByContract.get(row.id) ?? null,
      })),
      total: count ?? 0,
      statsRows: stats.data ?? [],
    }
  },
  ["contract-page"],
  { revalidate: HOUR }
)

export const getRevolvingDoorCases = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("v_revolving_door_public")
      .select(
        "id, person_name, political_party, public_role, public_organization, public_exit_date, private_role, private_organization, private_start_date, authorization_date, cooling_off_months, sector, person_id, organization_id, primary_source_url, source_url, sources"
      )
      .order("person_name")

    if (!error) return data ?? []

    const { data: legacyData } = await supabase
      .from("revolving_door")
      .select(
        "id, person_name, political_party, public_role, public_organization, private_role, private_organization, sector, person_id, source_url"
      )
      .order("person_name")

    return ((legacyData as Record<string, unknown>[] | null) ?? []).map((entry) => ({
      id: String(entry.id || `${entry.person_name}-${entry.private_organization}`),
      person_name: String(entry.person_name || ""),
      political_party: String(entry.political_party || ""),
      public_role: String(entry.public_role || ""),
      public_organization: String(entry.public_organization || ""),
      public_exit_date: null,
      private_role: String(entry.private_role || ""),
      private_organization: String(entry.private_organization || ""),
      private_start_date: null,
      authorization_date: null,
      cooling_off_months: null,
      sector: String(entry.sector || "Sin clasificar"),
      person_id: (entry.person_id as string | null) || null,
      primary_source_url: null,
      source_url: (entry.source_url as string | null) || null,
      sources: [],
    }))
  },
  ["revolving-door-cases"],
  { revalidate: HOUR }
)

export const getOrganizationPageData = unstable_cache(
  async (id: string) => {
    const [organization, contracts, beneficiarySubsidies, grantingSubsidies, revolvingDoorCases] =
      await Promise.all([
        supabase.from("v_organization_public").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("contracts")
          .select("id, title, amount, date, source_url")
          .eq("awarding_body_organization_id", id)
          .order("date", { ascending: false })
          .limit(20),
        supabase
          .from("subsidies")
          .select("id, beneficiario, importe, fecha_concesion, source_url")
          .eq("beneficiary_organization_id", id)
          .order("fecha_concesion", { ascending: false })
          .limit(20),
        supabase
          .from("subsidies")
          .select("id, nivel3, beneficiario, importe, fecha_concesion, source_url")
          .eq("granting_body_organization_id", id)
          .order("fecha_concesion", { ascending: false })
          .limit(20),
        supabase
          .from("v_revolving_door_public")
          .select(
            "id, person_name, person_id, private_role, private_organization, public_role, public_organization, private_start_date, primary_source_url, source_url"
          )
          .eq("organization_id", id)
          .order("private_start_date", { ascending: false, nullsFirst: false })
          .limit(20),
      ])

    return {
      organization: organization.data as OrganizationPublicRow | null,
      contracts: contracts.data ?? [],
      beneficiarySubsidies: beneficiarySubsidies.data ?? [],
      grantingSubsidies: grantingSubsidies.data ?? [],
      revolvingDoorCases: revolvingDoorCases.data ?? [],
    }
  },
  ["organization-page-data"],
  { revalidate: HOUR }
)

export const getMoneyDataOverview = unstable_cache(
  async () => {
    const [coverage, examples] = await Promise.all([
      supabase
        .from("v_money_data_public")
        .select(
          "dataset, administration_level, freshness_window, total_rows, resolved_rows, unresolved_rows, conflict_rows, coverage_start_date, latest_record_date"
        )
        .order("dataset")
        .order("administration_level"),
      supabase
        .from("v_unresolved_money_examples")
        .select(
          "dataset, record_id, record_date, body_name, body_normalized, administration_level, display_title, source_url, issue_type"
        )
        .order("record_date", { ascending: false })
        .limit(18),
    ])

    const coverageRows = (coverage.data ?? []) as MoneyCoverageRow[]
    const exampleRows = (examples.data ?? []) as UnresolvedMoneyExampleRow[]

    return {
      coverage: coverageRows,
      examples: exampleRows,
    }
  },
  ["money-data-overview"],
  { revalidate: HOUR }
)

export const getMoneyDatasetSummary = unstable_cache(
  async (dataset: "contracts" | "subsidies") => {
    const { data } = await supabase
      .from("v_money_data_public")
      .select(
        "dataset, administration_level, freshness_window, total_rows, resolved_rows, unresolved_rows, conflict_rows, coverage_start_date, latest_record_date"
      )
      .eq("dataset", dataset)
      .order("administration_level")

    const rows = (data ?? []) as MoneyCoverageRow[]
    const total = rows.reduce(
      (acc, row) => {
        acc.total_rows += row.total_rows
        acc.resolved_rows += row.resolved_rows
        acc.unresolved_rows += row.unresolved_rows
        acc.conflict_rows += row.conflict_rows
        if (!acc.coverage_start_date || (row.coverage_start_date && row.coverage_start_date < acc.coverage_start_date)) {
          acc.coverage_start_date = row.coverage_start_date
        }
        if (!acc.latest_record_date || (row.latest_record_date && row.latest_record_date > acc.latest_record_date)) {
          acc.latest_record_date = row.latest_record_date
        }
        return acc
      },
      {
        total_rows: 0,
        resolved_rows: 0,
        unresolved_rows: 0,
        conflict_rows: 0,
        coverage_start_date: null as string | null,
        latest_record_date: null as string | null,
      }
    )

    return { rows, total }
  },
  ["money-dataset-summary"],
  { revalidate: HOUR }
)
