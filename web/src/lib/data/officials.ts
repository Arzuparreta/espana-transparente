import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, throwDataError } from "./shared"

export interface PublicOfficial {
  id: string
  full_name: string
  administration_level: "state" | "autonomic" | "municipal" | null
  political_party: string | null
  wikidata_qid: string | null
  photo_url: string | null
  photo_variants: Record<string, string> | null
  source_url: string | null
}

export interface PublicOfficialPosition {
  id: string
  position_type: string | null
  organization_name: string | null
  territory_name: string | null
  territory_code: string | null
  government: string | null
  political_party: string | null
  start_date: string | null
  end_date: string | null
  source_url: string | null
}

export const getOfficialDetail = unstable_cache(
  async (id: string) => {
    const [official, positions] = await Promise.all([
      supabase
        .from("public_officials")
        .select("id, full_name, administration_level, political_party, wikidata_qid, photo_url, photo_variants, source_url")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("responsibility_positions")
        .select("id, position_type, organization_name, territory_name, territory_code, government, political_party, start_date, end_date, source_url")
        .eq("official_id", id)
        .order("start_date", { ascending: false }),
    ])
    throwDataError(official.error, "official detail")
    throwDataError(positions.error, "official positions")

    return {
      official: (official.data ?? null) as PublicOfficial | null,
      positions: (positions.data ?? []) as PublicOfficialPosition[],
    }
  },
  ["official-detail"],
  { revalidate: HOUR * 24 }
)
