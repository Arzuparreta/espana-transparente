import { unstable_cache } from "next/cache"
import { supabase } from "@/lib/supabase/client"

const HOUR = 3600
const PHOTOS_CACHE_VERSION = "photos-v2"

const CANONICAL_PARTY_NAMES: Record<string, string> = {
  PP: "Partido Popular",
  PSOE: "Partido Socialista Obrero Español",
  VOX: "VOX",
  SUMAR: "SUMAR",
  ERC: "Esquerra Republicana de Catalunya",
  JUNTS: "Junts per Catalunya",
  "EH Bildu": "EH Bildu",
  "EAJ-PNV": "Partido Nacionalista Vasco",
  UPN: "Unión del Pueblo Navarro",
  BNG: "Bloque Nacionalista Galego",
  CCa: "Coalición Canaria",
  Podemos: "Podemos",
  Ciudadanos: "Ciudadanos",
  PRC: "Partido Regionalista de Cantabria",
}

function isParliamentaryGroupName(value: string | null | undefined) {
  return /^grupo parlamentario\b/i.test(value ?? "")
}

function normalizePartyName(acronym: string | null | undefined, name: string | null | undefined) {
  if (acronym && CANONICAL_PARTY_NAMES[acronym]) return CANONICAL_PARTY_NAMES[acronym]
  if (name && !isParliamentaryGroupName(name)) return name
  return name ?? acronym ?? "Sin partido"
}

type PartyRow = { id: string; acronym: string | null; color: string | null; name: string }

function unwrapParty(value: unknown): PartyRow | null {
  if (!value) return null
  if (Array.isArray(value)) return (value[0] as PartyRow | undefined) ?? null
  return value as PartyRow
}

export const PAGE_SIZE = {
  votingSessions: 30,
  contracts: 50,
  deputyVotes: 30,
  subsidies: 50,
  euFunds: 50,
  organizations: 50,
}

export function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number.parseInt(raw ?? "1", 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

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
      // Deuda pública: dato más reciente
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
          ? {
              year: currentBudgetYear,
              total: budgetTotal,
              budgetType: currentBudgetType,
            }
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

export type TopContractAncla = {
  id: string
  title: string
  amount: number | null
  awarding_body: string | null
  contractor: string | null
  date: string | null
  /** Días hacia atrás de la ventana que devolvió este registro (30, 60, 90) o null si vino del all-time fallback. */
  windowDays: 30 | 60 | 90 | null
}

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

export type TopDivergenceSessionAncla = {
  id: string
  title: string
  date: string | null
  divergence_count: number | null
  isRecent: boolean
}

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

export type InflationAnchor = {
  period: string
  monthlyValue: number
  annualValue: number | null
  dataType: string | null
}

export const getLatestInflationAnchor = unstable_cache(
  async (): Promise<InflationAnchor | null> => {
    const monthly = await supabase
      .from("economic_indicators")
      .select("period, value, raw_data")
      .eq("indicator_code", "IPC_VAR_MENSUAL")
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (monthly.data?.value == null || monthly.data.period == null) {
      return null
    }

    const annual = await supabase
      .from("economic_indicators")
      .select("period, value")
      .eq("indicator_code", "IPC_VAR_ANUAL")
      .eq("period", monthly.data.period as string)
      .limit(1)
      .maybeSingle()

    const rawData = monthly.data.raw_data as
      | { point?: { T3_TipoDato?: string | null } }
      | null
      | undefined

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

export const getDeputyCards = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("politicians")
      .select(
        "id, first_name, last_name, full_name, photo_url, photo_variants, politician_memberships!inner(id, constituency, group_parliamentary, is_active, chamber, party:parties(id, acronym, color, name, logo_url))"
      )
      .eq("politician_memberships.is_active", true)
      .eq("politician_memberships.chamber", "congress")
      .order("full_name")

    return data ?? []
  },
  ["deputy-cards", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

export const getParties = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("politician_memberships")
      .select("party:parties(id, acronym, color, name, logo_url)")
      .eq("is_active", true)
      .eq("chamber", "congress")

    const grouped = new Map<
      string,
      {
        id: string
        name: string
        acronym: string | null
        color: string | null
        logo_url: string | null
        stats: { deputy_count: number }
      }
    >()

    for (const row of data ?? []) {
      const party = unwrapParty(row.party)
      if (!party) continue

      const key = party.acronym ?? party.id
      const normalizedName = normalizePartyName(party.acronym, party.name)
      const existing = grouped.get(key)

      if (existing) {
        existing.stats.deputy_count += 1
        if (isParliamentaryGroupName(existing.name) && !isParliamentaryGroupName(normalizedName)) {
          existing.id = party.id
          existing.name = normalizedName
          existing.color = party.color
          existing.logo_url = (party as { logo_url?: string | null }).logo_url ?? null
        }
        continue
      }

      grouped.set(key, {
        id: party.id,
        name: normalizedName,
        acronym: party.acronym,
        color: party.color,
        logo_url: (party as { logo_url?: string | null }).logo_url ?? null,
        stats: { deputy_count: 1 },
      })
    }

    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name, "es"))
  },
  ["parties"],
  { revalidate: HOUR }
)

export const getPartyPageData = unstable_cache(
  async (id: string) => {
    const [party, memberships, stats] = await Promise.all([
      supabase.from("parties").select("*").eq("id", id).single(),
      supabase
        .from("politician_memberships")
        .select(
          "id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name), politician:politicians(id, first_name, last_name, full_name, photo_url, photo_variants)"
        )
        .eq("party_id", id)
        .eq("is_active", true)
        .eq("chamber", "congress")
        .order("constituency"),
      supabase
        .from("v_party_stats")
        .select("deputy_count, total_votes, attendance_pct, pct_yes, pct_no, pct_abstain, pct_absent")
        .eq("party_id", id)
        .maybeSingle(),
    ])

    return {
      party: party.data
        ? {
            ...party.data,
            name: normalizePartyName(party.data.acronym, party.data.name),
          }
        : null,
      memberships: memberships.data ?? [],
      stats: stats.data ?? null,
    }
  },
  ["party-page-data", PHOTOS_CACHE_VERSION],
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
          "vote, politician_id, politician:politicians(id, full_name, politician_memberships(is_active, party:parties(id, acronym, color)))"
        )
        .eq("voting_session_id", id),
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
    const [pol, votes, totalVotes, powerRels, subordinates, revolvingDoors, attendance, divergences, govPosition] =
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
          .select("vote, voting_session_id, voting_sessions!inner(id, date, title, initiative_number)")
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
        supabase
          .from("power_relationships")
          .select("relationship_type, party:parties(acronym, color)")
          .eq("superior_id", id)
          .limit(1),
        supabase.from("v_revolving_door_public").select("*").eq("person_id", id),
        supabase
          .from("v_attendance_summary")
          .select("total_sessions, sessions_present, attendance_pct")
          .eq("politician_id", id)
          .maybeSingle(),
        supabase.rpc("get_politician_divergences", { p_politician_id: id }),
        supabase
          .from("responsibility_positions")
          .select("id, position_type, organization_name, government, start_date, source_url")
          .eq("politician_id", id)
          .is("end_date", null)
          .eq("administration_level", "state")
          .maybeSingle(),
      ])

    // If this person is a minister, fetch recent contracts from their ministry
    const govPos = govPosition.data ?? null
    let ministryContracts: unknown[] = []
    if (govPos?.organization_name) {
      const { data: mc } = await supabase
        .from("contracts")
        .select("id, title, amount, date, awarding_body")
        .eq("ministry_normalized", govPos.organization_name)
        .order("amount", { ascending: false, nullsFirst: false })
        .limit(5)
      ministryContracts = mc ?? []
    }

    return {
      pol: pol.data,
      votes: votes.data ?? [],
      totalVotes: totalVotes.count,
      powerRels: powerRels.data ?? [],
      subordinates: subordinates.data ?? [],
      revolvingDoors: revolvingDoors.data ?? [],
      attendance: attendance.data,
      divergentSessionIds: (divergences.data ?? []).map(
        (d: { voting_session_id: string }) => d.voting_session_id
      ),
      govPosition: govPos,
      ministryContracts,
    }
  },
  ["politician-profile-data", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

export const getDeputyVotes = unstable_cache(
  async (id: string, page: number) => {
    const offset = (page - 1) * PAGE_SIZE.deputyVotes
    const { data } = await supabase
      .from("votes")
      .select("vote, voting_session_id, voting_sessions!inner(id, date, title, initiative_number)")
      .eq("politician_id", id)
      .order("date", { ascending: false, foreignTable: "voting_sessions" })
      .range(offset, offset + PAGE_SIZE.deputyVotes - 1)
    return data ?? []
  },
  ["deputy-votes", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

export const getOrganizationsList = unstable_cache(
  async (page: number) => {
    const offset = (page - 1) * 50
    const { data, count } = await supabase
      .from("v_organization_public")
      .select("id, name, organization_type, sector, country, contract_count, subsidy_beneficiary_count, subsidy_granting_count, revolving_door_count", { count: "exact" })
      .order("contract_count", { ascending: false, nullsFirst: false })
      .range(offset, offset + 49)
    return { organizations: data ?? [], total: count ?? 0 }
  },
  ["organizations-list"],
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
    const from = (page - 1) * PAGE_SIZE.subsidies
    const to = from + PAGE_SIZE.subsidies - 1

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

    return data ?? []
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

export const getDivergenceRanking = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_divergence_ranking")
      .select("politician_id, full_name, party_acronym, party_color, photo_url, photo_variants, divergence_count")
      .order("divergence_count", { ascending: false })
      .limit(50)
    return data ?? []
  },
  ["divergence-ranking"],
  { revalidate: HOUR * 6 }
)

export const getSubsidyDetail = unstable_cache(
  async (id: string) => {
    const [subsidy, responsibility, beneficiary, grantingBody] = await Promise.all([
      supabase
        .from("subsidies")
        .select(
          "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, numero_convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url, ministry_normalized"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("v_subsidy_responsibility")
        .select("person_name, politician_id, ministry, government, political_party, administration_level, territory_name")
        .eq("subsidy_id", id)
        .maybeSingle(),
      supabase
        .from("subsidies")
        .select("beneficiary_organization_id, organizations:beneficiary_organization_id(id, name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("subsidies")
        .select("granting_body_organization_id, organizations:granting_body_organization_id(id, name)")
        .eq("id", id)
        .maybeSingle(),
    ])
    const benRaw = beneficiary.data?.organizations as unknown
    const grantRaw = grantingBody.data?.organizations as unknown
    const pickOrg = (raw: unknown): { id: string; name: string } | null => {
      if (!raw) return null
      const obj = Array.isArray(raw) ? raw[0] : raw
      return (obj as { id: string; name: string }) ?? null
    }
    return {
      subsidy: subsidy.data,
      responsible: responsibility.data ?? null,
      beneficiaryOrg: pickOrg(benRaw),
      grantingOrg: pickOrg(grantRaw),
    }
  },
  ["subsidy-detail"],
  { revalidate: HOUR }
)

export const getContractDetail = unstable_cache(
  async (id: string) => {
    const [contract, responsibility] = await Promise.all([
      supabase
        .from("contracts")
        .select(
          "id, contract_folder_id, title, awarding_body, awarding_body_normalized, awarding_body_organization_id, amount, currency, date, contractor, description, source_url, contract_type, cpv_code, region, ministry_normalized, administration_level"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("v_contract_responsibility")
        .select("person_name, politician_id, ministry, government, political_party, administration_level, territory_name")
        .eq("contract_id", id)
        .maybeSingle(),
    ])
    return {
      contract: contract.data,
      responsible: responsibility.data ?? null,
    }
  },
  ["contract-detail"],
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

export type BudgetType = "ley" | "prorroga" | "proyecto"

export const BUDGET_YEAR_META: Record<
  number,
  {
    budgetType: BudgetType
    label: string
    note: string
  }
> = {
  2016: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2017: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2018: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2019: {
    budgetType: "proyecto",
    label: "No aprobado",
    note: "Los datos publicados corresponden al proyecto 2019P; no llegó a aprobarse y no entró en vigor.",
  },
  2021: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2022: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2023: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2024: {
    budgetType: "prorroga",
    label: "Prórroga vigente",
    note: "No hubo un nuevo presupuesto aprobado. Siguieron en vigor los créditos prorrogados del PGE 2023, publicados por SEPG.",
  },
  2025: {
    budgetType: "prorroga",
    label: "Prórroga vigente",
    note: "No hubo un nuevo presupuesto aprobado. Siguieron en vigor los créditos prorrogados del PGE 2023, publicados por SEPG.",
  },
  2026: {
    budgetType: "prorroga",
    label: "Prórroga vigente",
    note: "No hubo un nuevo presupuesto aprobado. Siguen en vigor los créditos prorrogados del PGE 2023, publicados por SEPG para 2026.",
  },
}

export const BUDGET_YEARS = Object.keys(BUDGET_YEAR_META)
  .map((year) => Number.parseInt(year, 10))
  .sort((a, b) => a - b)

export function getBudgetYearMeta(year: number) {
  return BUDGET_YEAR_META[year] ?? null
}

export const getBudgetSummary = unstable_cache(
  async (year: number) => {
    const { data } = await supabase
      .from("v_budget_summary")
      .select("year, budget_type, section_code, section_name, ministry_normalized, program_count, total_credit_initial, total_credit_final")
      .eq("year", year)
      .order("total_credit_initial", { ascending: false, nullsFirst: false })
    return data ?? []
  },
  ["budget-summary"],
  { revalidate: HOUR }
)

export const getBudgetSection = unstable_cache(
  async (year: number, sectionCode: string) => {
    const { data } = await supabase
      .from("v_budget_by_program")
      .select("year, budget_type, section_code, section_name, program_code, program_name, ministry_normalized, total_credit_initial, total_credit_final, by_chapter")
      .eq("year", year)
      .eq("section_code", sectionCode)
      .order("total_credit_initial", { ascending: false, nullsFirst: false })
    return data ?? []
  },
  ["budget-section"],
  { revalidate: HOUR }
)

export const getBudgetMinister = unstable_cache(
  async (year: number, sectionCode: string) => {
    const { data } = await supabase
      .from("v_budget_responsibility")
      .select("budget_type, minister_name, responsibility_position_id")
      .eq("year", year)
      .eq("section_code", sectionCode)
      .not("minister_name", "is", null)
      .limit(1)
      .maybeSingle()
    return data ?? null
  },
  ["budget-minister"],
  { revalidate: HOUR }
)

export type TopBudgetSectionAncla = {
  year: number
  budget_type: string | null
  section_code: string
  section_name: string
  ministry_normalized: string | null
  total_credit_initial: number
  minister_name: string | null
  statusLabel: string | null
}

export const getTopBudgetSectionAnchor = unstable_cache(
  async (): Promise<TopBudgetSectionAncla | null> => {
    for (let i = BUDGET_YEARS.length - 1; i >= 0; i--) {
      const year = BUDGET_YEARS[i]
      const { data } = await supabase
        .from("v_budget_summary")
        .select(
          "year, budget_type, section_code, section_name, ministry_normalized, total_credit_initial"
        )
        .eq("year", year)
        .gt("total_credit_initial", 0)
        .order("total_credit_initial", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      if (!data?.total_credit_initial) continue

      const minister = await getBudgetMinister(year, data.section_code as string)
      const meta = getBudgetYearMeta(year)

      return {
        year,
        budget_type: (data.budget_type as string | null) ?? null,
        section_code: data.section_code as string,
        section_name: data.section_name as string,
        ministry_normalized: (data.ministry_normalized as string | null) ?? null,
        total_credit_initial: data.total_credit_initial as number,
        minister_name: (minister?.minister_name as string | null) ?? null,
        statusLabel: meta?.label ?? null,
      }
    }
    return null
  },
  ["top-budget-section-anchor"],
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

export interface GobiernoMember {
  id: string
  position_type: "presidente_gobierno" | "vicepresidente" | "ministro"
  person_name: string
  organization_name: string
  political_party: string
  politician_id: string | null
  party_color: string | null
  contract_count: number
  total_amount_eur: number
  government: string
  start_date: string | null
  source_url: string | null
}

export const getGobiernoActual = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_gobierno_actual")
      .select(
        "id, position_type, person_name, organization_name, political_party, politician_id, party_color, contract_count, total_amount_eur, government, start_date, source_url"
      )
    return (data ?? []) as GobiernoMember[]
  },
  ["gobierno-actual"],
  { revalidate: HOUR * 24 }
)

export interface MinistrioContract {
  id: string
  title: string
  amount: number | null
  date: string | null
  awarding_body: string | null
  contractor: string | null
}

export const getMinistrioDetail = unstable_cache(
  async (id: string) => {
    const { data: member } = await supabase
      .from("v_gobierno_actual")
      .select(
        "id, position_type, person_name, organization_name, political_party, politician_id, party_color, contract_count, total_amount_eur, government, start_date, source_url"
      )
      .eq("id", id)
      .single()

    if (!member) return { member: null, contracts: [] }

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, title, amount, date, awarding_body, contractor")
      .ilike("ministry_normalized", (member as GobiernoMember).organization_name)
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(20)

    return {
      member: member as GobiernoMember,
      contracts: (contracts ?? []) as MinistrioContract[],
    }
  },
  ["ministerio-detail"],
  { revalidate: HOUR * 6 }
)

export interface InstitucionMember {
  id: string
  institution: "TC" | "CGPJ" | "RTVE" | "SEPI"
  position_title: string
  person_name: string
  political_party: string | null
  nominating_body: string | null
  appointment_date: string | null
  source_url: string | null
  party_color: string | null
  photo_url: string | null
  photo_variants: Record<string, string> | null
  politician_id: string | null
  has_revolving_door: boolean
}

export const getInstitucionesActuales = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_instituciones_actuales")
      .select(
        "id, institution, position_title, person_name, political_party, nominating_body, appointment_date, source_url, party_color, photo_url, photo_variants, politician_id, has_revolving_door"
      )
    return (data ?? []) as InstitucionMember[]
  },
  ["instituciones-actuales"],
  { revalidate: HOUR * 24 }
)

export interface SearchResult {
  entity_type:
    | "politician"
    | "senator"
    | "party"
    | "government_position"
    | "institution"
    | "organization"
    | "voting_session"
    | "vote_divergence"
    | "contract"
    | "subsidy"
    | "initiative"
    | "budget"
    | "budget_program"
    | "indicator"
    | "eu_fund"
    | "revolving_door"
    | "source_document"
  id: string
  title: string
  subtitle: string | null
  url: string
  key_fact?: string | null
  document_date?: string | null
  amount?: number | null
  source_url?: string | null
  metadata?: Record<string, unknown> | null
  official_name?: string | null
  rank?: number
}

function mapSearchResult(row: SearchResult): SearchResult {
  const official =
    typeof row.metadata?.official_name === "string" ? row.metadata.official_name : row.official_name ?? null
  return official ? { ...row, official_name: official } : row
}

function isNameLikeQuery(normalized: string): boolean {
  if (/\d/.test(normalized)) return false
  if (
    /\b(subvencion|subvenciones|bdns|contrato|contratos|licitacion|pcsp|presupuesto|presupuestos|pge|importe)\b/.test(
      normalized
    )
  ) {
    return false
  }
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return false
  if (tokens.length === 1) {
    const token = tokens[0]
    if (token.length < 5) return false
    if (token === token.toUpperCase() && token.length <= 5) return false
    return /^[a-z-]+$/.test(token)
  }
  return tokens.every((token) => /^[a-z-]+$/.test(token))
}

function inferSearchEntityTypes(query: string): SearchResult["entity_type"][] | null {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (isNameLikeQuery(normalized)) {
    return ["politician", "senator", "government_position", "institution"]
  }

  if (/\b(subvencion|subvenciones|bdns)\b/.test(normalized)) return ["subsidy"]
  if (/\b(contrato|contratos|licitacion|pcsp)\b/.test(normalized)) return ["contract"]
  if (/\b(presupuesto|presupuestos|pge|programa)\b/.test(normalized)) return ["budget", "budget_program"]
  if (/\b(indicador|indicadores|ipc|deuda|pib)\b/.test(normalized)) return ["indicator"]
  if (/\b(iniciativa|iniciativas|ley|boe|normativa)\b/.test(normalized)) return ["initiative", "source_document"]
  if (/\b(voto|vota|voto|votacion|votaciones|grupo|divergencia|divergencias)\b/.test(normalized)) {
    return ["vote_divergence", "voting_session"]
  }
  if (/\b(senador|senadora|senado)\b/.test(normalized)) return ["senator"]
  if (/\b(diputado|diputada|persona|personas)\b/.test(normalized)) {
    return ["politician", "senator", "government_position", "institution"]
  }
  return null
}

export interface EuFundRow {
  id: string
  label: string
  eu_budget: number | null
  total_budget: number | null
  cofinancing_rate: number | null
  number_projects: number | null
  wikidata_link: string | null
}

export interface EuFundsSummary {
  beneficiary_count: number
  total_eu_budget: number
  avg_cofinancing_rate: number
  total_projects: number
}

export const getEuFundsPage = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * PAGE_SIZE.euFunds
    const to = from + PAGE_SIZE.euFunds - 1
    const { data, count } = await supabase
      .from("eu_funds")
      .select("id, label, eu_budget, total_budget, cofinancing_rate, number_projects, wikidata_link", {
        count: "exact",
      })
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

export async function searchGlobal(query: string, maxPerType = 5): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const { data } = await supabase.rpc("search_global", {
    query_text: query.trim(),
    max_per_type: maxPerType,
  })
  return ((data ?? []) as SearchResult[]).map(mapSearchResult)
}

export async function searchDocuments(
  query: string,
  options: { entityTypes?: SearchResult["entity_type"][]; filters?: Record<string, unknown>; limit?: number } = {}
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const entityTypes = options.entityTypes ?? inferSearchEntityTypes(query)
  const { data, error } = await supabase.rpc("search_documents", {
    query_text: query.trim(),
    entity_types: entityTypes,
    filters: options.filters ?? {},
    limit_count: options.limit ?? 24,
  })
  if (error) {
    console.error("searchDocuments:", error.message)
    return searchGlobal(query, Math.max(1, Math.ceil((options.limit ?? 24) / 8)))
  }
  return ((data ?? []) as SearchResult[]).map(mapSearchResult)
}

export async function searchSuggestions(query: string, limit = 12): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const { data, error } = await supabase.rpc("search_suggestions", {
    query_text: query.trim(),
    limit_count: limit,
  })
  if (error) {
    console.error("searchSuggestions:", error.message)
    return searchDocuments(query, { limit })
  }
  return ((data ?? []) as SearchResult[]).map(mapSearchResult)
}

// ME-1: party voting sessions
export const getPartyVotingSessions = unstable_cache(
  async (partyId: string) => {
    const { data: members } = await supabase
      .from("politician_memberships")
      .select("politician_id")
      .eq("party_id", partyId)
      .eq("is_active", true)
      .eq("chamber", "congress")

    if (!members || members.length === 0) return []

    const memberIds = members.map((m) => m.politician_id)

    const { data: sessions } = await supabase
      .from("v_voting_session_summary")
      .select("id, title, date, divergence_count, votes_yes, votes_no, votes_abstain, votes_no_vote")
      .order("date", { ascending: false })
      .limit(30)

    if (!sessions || sessions.length === 0) return []

    const sessionIds = sessions.map((s) => s.id as string)

    const { data: votes } = await supabase
      .from("votes")
      .select("voting_session_id, vote")
      .in("politician_id", memberIds)
      .in("voting_session_id", sessionIds)

    const bySession = new Map<string, Record<string, number>>()
    for (const v of votes ?? []) {
      const sid = v.voting_session_id as string
      const map = bySession.get(sid) ?? {}
      const key = String(v.vote ?? "")
      map[key] = (map[key] ?? 0) + 1
      bySession.set(sid, map)
    }

    return sessions.map((s) => ({
      id: s.id as string,
      title: s.title as string,
      date: s.date as string,
      divergence_count: (s.divergence_count as number) ?? 0,
      partyVotes: bySession.get(s.id as string) ?? {},
    }))
  },
  ["party-voting-sessions"],
  { revalidate: HOUR }
)

// ME-2: initiative detail
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

// ME-3: deputy attendance session list
export const getDeputyAttendanceSessions = unstable_cache(
  async (politicianId: string, page: number) => {
    const PAGE = 50
    const offset = (page - 1) * PAGE
    const { data, count } = await supabase
      .from("v_session_attendance")
      .select("session_number, session_date, was_present, votes_cast, total_votaciones", { count: "exact" })
      .eq("politician_id", politicianId)
      .order("session_date", { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE - 1)
    return { sessions: data ?? [], total: count ?? 0, pageSize: PAGE }
  },
  ["deputy-attendance-sessions"],
  { revalidate: HOUR }
)

// ME-4: ETL pipeline freshness
export const getEtlPipelineStatus = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_etl_pipeline_status")
      .select("pipeline, last_status, last_finished_at, last_rows_inserted, last_rows_updated, last_error_summary")
      .order("pipeline")
    return data ?? []
  },
  ["etl-pipeline-status"],
  { revalidate: HOUR }
)

// ME-6: contract page with optional minister filter
export const getContractPageFiltered = unstable_cache(
  async (page: number, type: string, ministry: string | null) => {
    const from = (page - 1) * PAGE_SIZE.contracts
    const to = from + PAGE_SIZE.contracts - 1
    let query = supabase
      .from("contracts")
      .select(
        "id, contract_folder_id, title, awarding_body, awarding_body_organization_id, amount, status, contract_type, region, date, source_url",
        { count: "exact" }
      )
      .order("amount", { ascending: false, nullsFirst: false })

    if (type !== "all") query = query.eq("contract_type", type)
    if (ministry) query = query.eq("ministry_normalized", ministry)

    const { data, count } = await query.range(from, to)
    const contractIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      contractIds.length > 0
        ? await supabase
            .from("v_contract_responsibility")
            .select("contract_id, person_name, politician_id, ministry, government, political_party, administration_level, territory_name, match_method")
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

    return {
      contracts: (data ?? []).map((row) => ({ ...row, responsible: responsibleByContract.get(row.id) ?? null })),
      total: count ?? 0,
    }
  },
  ["contract-page-filtered"],
  { revalidate: HOUR }
)

// ME-6: subsidy page with optional ministry filter
export const getSubvencionPageFiltered = unstable_cache(
  async (page: number, nivel1: string, ministry: string | null) => {
    const from = (page - 1) * PAGE_SIZE.subsidies
    const to = from + PAGE_SIZE.subsidies - 1
    let query = supabase
      .from("subsidies")
      .select(
        "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url",
        { count: "exact" }
      )
      .order("importe", { ascending: false, nullsFirst: false })

    if (nivel1 !== "all") query = query.eq("nivel1", nivel1)
    if (ministry) query = query.eq("ministry_normalized", ministry)

    const { data, count } = await query.range(from, to)
    const subsidyIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      subsidyIds.length > 0
        ? await supabase
            .from("v_subsidy_responsibility")
            .select("subsidy_id, person_name, politician_id, ministry, government, political_party, administration_level, territory_name, match_method")
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

    return {
      subsidies: (data ?? []).map((row) => ({ ...row, responsible: responsibleBySubsidy.get(row.id) ?? null })),
      total: count ?? 0,
    }
  },
  ["subsidy-page-filtered"],
  { revalidate: HOUR }
)

// ── Senado ────────────────────────────────────────────────────────────────────

export type Senator = {
  id: string
  full_name: string
  first_name: string
  last_name: string
  photo_url: string | null
  senate_id: string | null
  politician_memberships: {
    id: string
    constituency: string | null
    group_parliamentary: string | null
    is_active: boolean
    raw_data: Record<string, unknown> | null
    party: { id: string; acronym: string | null; color: string | null; name: string } | null
  }[]
}

export const getSenators = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("politicians")
      .select(
        "id, full_name, first_name, last_name, photo_url, senate_id, politician_memberships!inner(id, constituency, group_parliamentary, is_active, raw_data, party:parties(id, acronym, color, name))"
      )
      .eq("politician_memberships.is_active", true)
      .eq("politician_memberships.chamber", "senate")
      .order("last_name")

    if (error) {
      console.error("getSenators:", error.message)
      return [] as Senator[]
    }
    return (data ?? []) as unknown as Senator[]
  },
  ["senators-list"],
  { revalidate: HOUR * 6 }
)

export const getSenatorStats = unstable_cache(
  async () => {
    const { data: senators } = await supabase
      .from("politician_memberships")
      .select("id, constituency, raw_data, party:parties(acronym, color, name)")
      .eq("chamber", "senate")
      .eq("is_active", true)

    type PartyObj = { acronym: string | null; color: string | null; name: string } | null
    const byGroup = new Map<string, { party: PartyObj; count: number }>()
    for (const m of senators ?? []) {
      const party = (m.party as unknown) as PartyObj
      const key = party?.name ?? "Mixto"
      const existing = byGroup.get(key)
      if (existing) {
        existing.count++
      } else {
        byGroup.set(key, { party, count: 1 })
      }
    }

    const byType = { elected: 0, designated: 0 }
    for (const m of senators ?? []) {
      const rd = (m.raw_data as unknown) as { tipo_procedencia?: string } | null
      if (rd?.tipo_procedencia === "DESIGNADO") byType.designated++
      else byType.elected++
    }

    return {
      total: senators?.length ?? 0,
      byGroup: Array.from(byGroup.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.count - a.count),
      byType,
    }
  },
  ["senator-stats"],
  { revalidate: HOUR * 6 }
)

export const getPartyAcronymMap = unstable_cache(
  async () => {
    const { data } = await supabase.from("parties").select("id, acronym, name")
    const map: Record<string, string> = {}
    for (const p of (data ?? []) as { id: string; acronym: string | null; name: string | null }[]) {
      if (p.acronym) map[p.acronym.toLowerCase()] = p.id
      if (p.name) map[p.name.toLowerCase()] = p.id
    }
    return map
  },
  ["party-acronym-map"],
  { revalidate: HOUR * 24 }
)
