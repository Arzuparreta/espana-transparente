import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"
import { PAGE_SIZE } from "./shared"

export const getVotingSessionPage = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * PAGE_SIZE.votingSessions
    const to = from + PAGE_SIZE.votingSessions - 1
    const { data, count, error } = await supabase
      .from("v_voting_session_summary")
      .select(
        "id, title, session_number, chamber, date, initiative_number, votacion_number, vote_count, divergence_count",
        { count: "exact" }
      )
      .order("date", { ascending: false })
      .order("session_number", { ascending: false })
      .order("votacion_number", { ascending: true })
      .range(from, to)

    if (!error) return { sessions: data ?? [], total: count ?? 0 }

    const fallback = await supabase
      .from("voting_sessions")
      .select("id, title, session_number, chamber, date, initiative_number, votes(count)", { count: "exact" })
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
          "vote, politician_id, politician:politicians(id, full_name, politician_memberships(is_active, chamber, party:parties(id, acronym, color)))"
        )
        .eq("voting_session_id", id),
    ])

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
