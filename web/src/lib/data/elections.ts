import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"

export interface ElectionResult {
  election_date: string
  party: string
  party_short_name: string
  votes: number
  seats: number
  pct_vote: number
  color: string
  total_seats: number
  participation_pct: number
}

export interface ElectionProvince {
  election_date: string
  province_name: string
  seats: number
  effective_threshold: number
  description: string
}

export const getElectionDates = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("election_results")
      .select("election_date, total_seats, participation_pct")
      .order("election_date", { ascending: false })

    const seen = new Map<string, { date: string; total_seats: number; participation_pct: number }>()
    for (const row of (data ?? []) as unknown as ElectionResult[]) {
      if (!seen.has(row.election_date)) {
        seen.set(row.election_date, {
          date: row.election_date,
          total_seats: row.total_seats,
          participation_pct: row.participation_pct,
        })
      }
    }
    return Array.from(seen.values())
  },
  ["election-dates"],
  { revalidate: HOUR * 24 }
)

export const getElectionResults = unstable_cache(
  async (date: string) => {
    const { data } = await supabase
      .from("election_results")
      .select("*")
      .eq("election_date", date)
      .order("seats", { ascending: false })
    return (data ?? []) as unknown as ElectionResult[]
  },
  ["election-results"],
  { revalidate: HOUR * 24 }
)

export const getElectionProvinces = unstable_cache(
  async (date: string) => {
    const { data } = await supabase
      .from("election_provinces")
      .select("*")
      .eq("election_date", date)
      .order("seats", { ascending: true })
    return (data ?? []) as unknown as ElectionProvince[]
  },
  ["election-provinces"],
  { revalidate: HOUR * 24 }
)
