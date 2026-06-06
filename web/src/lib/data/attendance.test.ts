import { describe, expect, it } from "vitest"

import { parseAttendanceSort } from "../attendance-sort"
import { dataErrorMessage } from "./shared"

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

describe("dataErrorMessage", () => {
  it("collapses upstream HTML errors into a stable message", () => {
    expect(dataErrorMessage({ message: "<!DOCTYPE html><title>522</title>" })).toBe(
      "upstream gateway unavailable"
    )
  })

  it("keeps normal errors concise", () => {
    expect(dataErrorMessage(new Error("connection timed out"))).toBe("connection timed out")
  })
})
