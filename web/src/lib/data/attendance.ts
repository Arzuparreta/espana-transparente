import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE } from "./shared"

export interface AttendanceRankingRow {
  politician_id: string
  full_name: string
  photo_url: string | null
  photo_variants: Record<string, string> | null
  party_acronym: string | null
  party_color: string | null
  total_sessions: number
  sessions_present: number
  attendance_pct: number
}

export const getAttendanceRanking = unstable_cache(
  async (page: number, partyAcronym?: string | null) => {
    const from = (page - 1) * PAGE_SIZE.attendance
    const to = from + PAGE_SIZE.attendance - 1

    let query = supabase
      .from("v_attendance_ranking")
      .select(
        "politician_id, full_name, photo_url, photo_variants, party_acronym, party_color, total_sessions, sessions_present, attendance_pct",
        { count: "exact" }
      )
      .order("attendance_pct", { ascending: false })
      .order("sessions_present", { ascending: false })

    if (partyAcronym) {
      query = query.eq("party_acronym", partyAcronym)
    }

    const { data, count, error } = await query.range(from, to)

    if (error) {
      console.error("getAttendanceRanking error:", error)
      return { rows: [], total: 0, parties: [] }
    }

    // Get party list for filter pills
    const { data: partyData } = await supabase
      .from("v_attendance_ranking")
      .select("party_acronym, party_color")

    const partySet = new Map<string, string | null>()
    for (const row of (partyData ?? []) as unknown as Array<{
      party_acronym: string | null
      party_color: string | null
    }>) {
      const acronym = row.party_acronym
      if (acronym) {
        partySet.set(acronym, row.party_color ?? null)
      }
    }
    const parties = Array.from(partySet.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([acronym, color]) => ({ acronym, color }))

    const rows: AttendanceRankingRow[] = []
    for (const raw of (data ?? []) as unknown as Array<{
      politician_id: string
      total_sessions: number
      sessions_present: number
      attendance_pct: number
      full_name: string
      photo_url: string | null
      photo_variants: Record<string, string> | null
      party_acronym: string | null
      party_color: string | null
    }>) {
      rows.push({
        politician_id: raw.politician_id,
        full_name: raw.full_name,
        photo_url: raw.photo_url,
        photo_variants: raw.photo_variants,
        party_acronym: raw.party_acronym,
        party_color: raw.party_color,
        total_sessions: raw.total_sessions,
        sessions_present: raw.sessions_present,
        attendance_pct: raw.attendance_pct,
      })
    }

    return { rows, total: count ?? 0, parties }
  },
  ["attendance-ranking-v2"],
  { revalidate: HOUR }
)
