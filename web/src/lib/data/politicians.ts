import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PHOTOS_CACHE_VERSION, type EntitySummaryRow } from "./shared"

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

export const getPoliticianProfileData = unstable_cache(
  async (id: string) => {
    const [pol, votes, totalVotes, powerRels, subordinates, revolvingDoors, attendance, divergences, govPosition, entitySummary] =
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
        supabase
          .from("v_entity_summary")
          .select("*")
          .eq("entity_type", "politician")
          .eq("entity_id", id)
          .maybeSingle(),
      ])

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
      entitySummary: entitySummary.data as EntitySummaryRow | null,
    }
  },
  ["politician-profile-data", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

export const getDeputyVotes = unstable_cache(
  async (id: string, page: number) => {
    const offset = (page - 1) * 30
    const { data } = await supabase
      .from("votes")
      .select("vote, voting_session_id, voting_sessions!inner(id, date, title, initiative_number)")
      .eq("politician_id", id)
      .order("date", { ascending: false, foreignTable: "voting_sessions" })
      .range(offset, offset + 29)
    return data ?? []
  },
  ["deputy-votes", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
)

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
