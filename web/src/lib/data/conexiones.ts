import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"

export const getRevolvingDoorCases = unstable_cache(
  async () => {
    const { data } = await supabase
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
