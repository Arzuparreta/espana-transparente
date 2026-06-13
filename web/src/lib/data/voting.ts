import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, throwDataError } from "./shared"
import { PAGE_SIZE } from "./shared"

interface VoteTally {
  vote_count: number
  votes_yes: number
  votes_no: number
  votes_abstain: number
  divergence_count: number
}

export const getVotingSessionPage = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * PAGE_SIZE.votingSessions
    const to = from + PAGE_SIZE.votingSessions - 1

    // Paginate over the lightweight base table. The summary view computes
    // per-group divergences with window functions over every vote and times
    // out when scanned with an exact count, so it is never used for listing.
    const { data: rows, count, error } = await supabase
      .from("voting_sessions")
      .select("id, title, session_number, chamber, date, initiative_number, votacion_number", { count: "exact" })
      .order("date", { ascending: false })
      .order("session_number", { ascending: false })
      .order("votacion_number", { ascending: true })
      .range(from, to)
    throwDataError(error, "voting sessions")

    const sessions = rows ?? []
    const ids = sessions.map((s) => s.id)

    // Enrich just this page's rows with tallies. Filtering the view by id
    // lets Postgres push the predicate down, so it stays fast (~0.3s).
    const tallies = new Map<string, VoteTally>()
    if (ids.length > 0) {
      const { data: summary } = await supabase
        .from("v_voting_session_summary")
        .select("id, vote_count, votes_yes, votes_no, votes_abstain, divergence_count")
        .in("id", ids)
      for (const row of summary ?? []) {
        tallies.set(row.id as string, {
          vote_count: (row.vote_count as number) ?? 0,
          votes_yes: (row.votes_yes as number) ?? 0,
          votes_no: (row.votes_no as number) ?? 0,
          votes_abstain: (row.votes_abstain as number) ?? 0,
          divergence_count: (row.divergence_count as number) ?? 0,
        })
      }
    }

    return {
      sessions: sessions.map((s) => ({ ...s, ...(tallies.get(s.id) ?? {}) })),
      total: count ?? 0,
    }
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
          "vote, politician_id, politician:politicians(id, full_name, politician_memberships(is_active, chamber, party:parties(id, acronym, color)))"
        )
        .eq("voting_session_id", id),
    ])
    throwDataError(session.error, "voting session detail")
    throwDataError(votes.error, "voting session votes")

    let initiative: { id: string; title: string | null; type: string | null } | null = null
    const initiativeNumber = session.data?.initiative_number as string | null | undefined
    if (initiativeNumber) {
      const { data } = await supabase
        .from("initiatives")
        .select("id, title, type")
        .eq("number", initiativeNumber)
        .maybeSingle()
      if (data) initiative = data
    }

    return { session: session.data, votes: votes.data ?? [], initiative }
  },
  ["voting-detail-data"],
  { revalidate: HOUR }
)

export const getDivergenceRanking = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("v_divergence_ranking")
      .select("politician_id, full_name, party_acronym, party_color, photo_url, photo_variants, divergence_count")
      .order("divergence_count", { ascending: false })
      .limit(50)
    throwDataError(error, "divergence ranking")
    return data ?? []
  },
  ["divergence-ranking"],
  { revalidate: HOUR * 6 }
)
