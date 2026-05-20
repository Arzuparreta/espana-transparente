import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, type Senator } from "./shared"

export type { Senator }

export const getSenateSessionCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from("voting_sessions")
        .select("*", { count: "exact", head: true })
        .eq("chamber", "senate")
      if (error) {
        console.error("getSenateSessionCount:", error.message)
        return 0
      }
      return count ?? 0
    } catch (err) {
      console.error("getSenateSessionCount:", err)
      return 0
    }
  },
  ["senate-session-count"],
  { revalidate: HOUR }
)

export const getSenateNominalVoteStats = unstable_cache(
  async (): Promise<{ sessionsWithVotes: number; voteRows: number }> => {
    try {
      const [sessions, votes] = await Promise.all([
        supabase
          .from("v_voting_session_summary")
          .select("*", { count: "exact", head: true })
          .eq("chamber", "senate")
          .gt("vote_count", 0),
        supabase
          .from("votes")
          .select("id, voting_sessions!inner(chamber)", { count: "exact", head: true })
          .eq("voting_sessions.chamber", "senate"),
      ])
      if (sessions.error) console.error("getSenateNominalVoteStats sessions:", sessions.error.message)
      if (votes.error) console.error("getSenateNominalVoteStats votes:", votes.error.message)
      return {
        sessionsWithVotes: sessions.count ?? 0,
        voteRows: votes.count ?? 0,
      }
    } catch (err) {
      console.error("getSenateNominalVoteStats:", err)
      return { sessionsWithVotes: 0, voteRows: 0 }
    }
  },
  ["senate-nominal-vote-stats"],
  { revalidate: HOUR }
)

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
      if (existing) { existing.count++ } else { byGroup.set(key, { party, count: 1 }) }
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
