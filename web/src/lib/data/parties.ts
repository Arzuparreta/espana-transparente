import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PHOTOS_CACHE_VERSION, unwrapParty, normalizePartyName, isParliamentaryGroupName } from "./shared"

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
        ? { ...party.data, name: normalizePartyName(party.data.acronym, party.data.name) }
        : null,
      memberships: memberships.data ?? [],
      stats: stats.data ?? null,
    }
  },
  ["party-page-data", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

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
      .eq("chamber", "congress")
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
