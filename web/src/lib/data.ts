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
          "id, first_name, last_name, full_name, photo_url, politician_memberships!inner(id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name))"
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
        "id, first_name, last_name, full_name, photo_url, politician_memberships!inner(id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name))"
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
          "id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name), politician:politicians(id, first_name, last_name, full_name, photo_url)"
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

export const getSubvencionPage = unstable_cache(
  async (page: number, nivel1: string) => {
    const from = (page - 1) * PAGE_SIZE_SUBSIDIES
    const to = from + PAGE_SIZE_SUBSIDIES - 1

    let query = supabase
      .from("subsidies")
      .select(
        "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, nivel1, nivel2, nivel3, source_url",
        { count: "exact" }
      )
      .order("importe", { ascending: false, nullsFirst: false })

    if (nivel1 !== "all") {
      query = query.eq("nivel1", nivel1)
    }

    const { data, count } = await query.range(from, to)

    const stats = await supabase
      .from("subsidies")
      .select("id, nivel1, importe")
      .limit(2000)

    return {
      subsidies: data ?? [],
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
        "id, contract_folder_id, title, awarding_body, amount, status, contract_type, region, date, source_url",
        { count: "exact" }
      )
      .order("amount", { ascending: false, nullsFirst: false })

    if (type !== "all") {
      query = query.eq("contract_type", type)
    }

    const { data, count } = await query.range(from, to)

    const stats = await supabase
      .from("contracts")
      .select("id, awarding_body, amount")
      .limit(1000)

    return {
      contracts: data ?? [],
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
        "id, person_name, political_party, public_role, public_organization, public_exit_date, private_role, private_organization, private_start_date, authorization_date, cooling_off_months, sector, person_id, primary_source_url, source_url, sources"
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
