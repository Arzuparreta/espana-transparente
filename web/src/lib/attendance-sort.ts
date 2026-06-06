export const ATTENDANCE_SORT_FIELDS = [
  "full_name",
  "party_acronym",
  "total_sessions",
  "sessions_present",
  "attendance_pct",
] as const

export type AttendanceSortField = (typeof ATTENDANCE_SORT_FIELDS)[number]
export type AttendanceSortDirection = "asc" | "desc"

export function parseAttendanceSort(
  sort: string | string[] | undefined,
  direction: string | string[] | undefined
): { sort: AttendanceSortField; direction: AttendanceSortDirection } {
  const rawSort = Array.isArray(sort) ? sort[0] : sort
  const rawDirection = Array.isArray(direction) ? direction[0] : direction
  const validSort = ATTENDANCE_SORT_FIELDS.find((field) => field === rawSort)

  return {
    sort: validSort ?? "attendance_pct",
    direction: rawDirection === "asc" ? "asc" : "desc",
  }
}
