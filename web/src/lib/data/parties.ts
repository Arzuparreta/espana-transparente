import { supabase } from "@/lib/supabase/public"
import { unstable_cache, HOUR, PHOTOS_CACHE_VERSION, throwDataError, unwrapParty, normalizePartyName, isParliamentaryGroupName } from "./shared"

export const getParties = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("politician_memberships")
      .select("party:parties(id, acronym, color, name, logo_url)")
      .eq("is_active", true)
      .eq("chamber", "congress")
    throwDataError(error, "party list")

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
      supabase.from("parties").select("*").eq("id", id).maybeSingle(),
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
        .from("mv_party_stats")
        .select("deputy_count, total_votes, attendance_pct, pct_yes, pct_no, pct_abstain, pct_absent")
        .eq("party_id", id)
        .maybeSingle(),
    ])

    throwDataError(party.error, "party detail")
    throwDataError(memberships.error, "party members")
    throwDataError(stats.error, "party statistics")

    return {
      party: party.data
        ? { ...party.data, name: normalizePartyName(party.data.acronym, party.data.name) }
        : null,
      memberships: memberships.data ?? [],
      stats: stats.data ?? null,
    }
  },
  ["party-page-data-v2", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

export const getPartyVotingSessions = unstable_cache(
  async (partyId: string) => {
    const { memberships } = await getPartyPageData(partyId)
    if (!memberships.length) return []
    const { data: sessions, error } = await supabase.from("voting_sessions")
      .select("id, title, date").eq("chamber", "congress")
      .order("date", { ascending: false }).order("id").limit(30)
    throwDataError(error, "party voting sessions")
    if (!sessions?.length) return []
    const ids = sessions.map((s) => s.id as string)
    const [partyResult, tallies] = await Promise.all([
      supabase.rpc("get_party_voting_tallies", { p_party_id: partyId, p_session_ids: ids }),
      supabase.rpc("get_voting_session_tallies", { p_session_ids: ids }),
    ])
    throwDataError(partyResult.error, "party vote totals")
    throwDataError(tallies.error, "session vote totals")
    if (tallies.data?.length !== ids.length) throw new Error("Incomplete party session tallies")
    const bySession = new Map<string, Record<string, number>>()
    for (const row of partyResult.data ?? []) {
      const map = bySession.get(row.voting_session_id) ?? {}
      map[row.vote] = Number(row.vote_count)
      bySession.set(row.voting_session_id, map)
    }
    const divergences = new Map<string, number>((tallies.data ?? []).map((row: { id: string; divergence_count: number }) => [row.id, Number(row.divergence_count)]))
    return sessions.map((s) => ({ id: s.id as string, title: s.title as string, date: s.date as string,
      divergence_count: divergences.get(s.id) ?? 0, partyVotes: bySession.get(s.id) ?? {} }))
  }, ["party-voting-sessions-v2"], { revalidate: HOUR }
)

export interface PartyCaseRow {
  case_id: string
  title: string
  procedural_status: string | null
  territory: string | null
  offence_category: string | null
  source_published_at: string | null
  court_body: string | null
  source_url: string | null
  actor_label: string | null
  actor_role: string | null
}

export const getPartyJudicialCases = unstable_cache(
  async (partyId: string): Promise<PartyCaseRow[]> => {
    const { data } = await supabase.rpc("get_party_cases", { p_party_id: partyId })
    return (data ?? []) as PartyCaseRow[]
  },
  ["party-judicial-cases"],
  { revalidate: HOUR }
)

export const getPartyCaseCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const { data } = await supabase.rpc("get_party_case_counts")
    const map: Record<string, number> = {}
    for (const row of (data ?? []) as { party_id: string; case_count: number }[]) {
      if (row.party_id) map[row.party_id] = row.case_count
    }
    return map
  },
  ["party-case-counts"],
  { revalidate: HOUR }
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
