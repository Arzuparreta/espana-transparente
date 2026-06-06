import { describe, expect, it } from "vitest"

import { parseAttendanceSort } from "../attendance-sort"

describe("parseAttendanceSort", () => {
  it("uses attendance descending by default", () => {
    expect(parseAttendanceSort(undefined, undefined)).toEqual({
      sort: "attendance_pct",
      direction: "desc",
    })
  })

  it("accepts supported fields and ascending direction", () => {
    expect(parseAttendanceSort("sessions_present", "asc")).toEqual({
      sort: "sessions_present",
      direction: "asc",
    })
  })

  it("rejects unsupported fields and directions", () => {
    expect(parseAttendanceSort("DROP TABLE", "sideways")).toEqual({
      sort: "attendance_pct",
      direction: "desc",
    })
  })
})
