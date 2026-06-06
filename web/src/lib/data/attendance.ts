import { supabase } from "@/lib/supabase/client"
import type { AttendanceSortDirection, AttendanceSortField } from "@/lib/attendance-sort"
import { dataErrorMessage, dataQuerySignal, unstable_cache, HOUR, PAGE_SIZE } from "./shared"

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

export type AttendanceRankingResult = {
  status: "ok" | "unavailable"
  rows: AttendanceRankingRow[]
  total: number
  parties: Array<{ acronym: string; color: string | null }>
}

const getAttendanceRankingCached = unstable_cache(
  async (
    page: number,
    partyAcronym?: string | null,
    sort: AttendanceSortField = "attendance_pct",
    direction: AttendanceSortDirection = "desc"
  ) => {
    const from = (page - 1) * PAGE_SIZE.attendance
    const to = from + PAGE_SIZE.attendance - 1
    const ascending = direction === "asc"

    let query = supabase
      .from("v_attendance_ranking")
      .select(
        "politician_id, full_name, photo_url, photo_variants, party_acronym, party_color, total_sessions, sessions_present, attendance_pct",
        { count: "exact" }
      )
      .order(sort, { ascending, nullsFirst: false })

    if (sort !== "attendance_pct") {
      query = query.order("attendance_pct", { ascending: false, nullsFirst: false })
    }
    if (sort !== "sessions_present") {
      query = query.order("sessions_present", { ascending: false, nullsFirst: false })
    }
    if (sort !== "full_name") {
      query = query.order("full_name", { ascending: true })
    }

    if (partyAcronym) {
      query = query.eq("party_acronym", partyAcronym)
    }

    const { data, count, error } = await query.range(from, to).abortSignal(dataQuerySignal())

    if (error) {
      console.error("getAttendanceRanking error:", dataErrorMessage(error))
      throw new Error("Attendance data source unavailable")
    }

    // Get party list for filter pills
    const { data: partyData, error: partyError } = await supabase
      .from("v_attendance_ranking")
      .select("party_acronym, party_color")
      .abortSignal(dataQuerySignal())

    if (partyError) {
      console.error("getAttendanceRanking parties error:", dataErrorMessage(partyError))
      throw new Error("Attendance party data source unavailable")
    }

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

    return {
      status: "ok",
      rows,
      total: count ?? 0,
      parties,
    } satisfies AttendanceRankingResult
  },
  ["attendance-ranking-v2"],
  { revalidate: HOUR }
)

export async function getAttendanceRanking(
  page: number,
  partyAcronym?: string | null,
  sort: AttendanceSortField = "attendance_pct",
  direction: AttendanceSortDirection = "desc"
): Promise<AttendanceRankingResult> {
  try {
    return await getAttendanceRankingCached(page, partyAcronym, sort, direction)
  } catch (error) {
    console.error("getAttendanceRanking unavailable:", dataErrorMessage(error))
    return {
      status: "unavailable",
      rows: [],
      total: 0,
      parties: [],
    }
  }
}
