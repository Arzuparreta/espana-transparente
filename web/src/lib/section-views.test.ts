import { describe, expect, it } from "vitest"
import { DEPUTY_VIEWS, parseView } from "./section-views"

describe("parseView", () => {
  it("accepts an allowed view", () => {
    expect(parseView("asistencia", DEPUTY_VIEWS, "directorio")).toBe("asistencia")
  })

  it("falls back for unknown and missing views", () => {
    expect(parseView("otra", DEPUTY_VIEWS, "directorio")).toBe("directorio")
    expect(parseView(undefined, DEPUTY_VIEWS, "directorio")).toBe("directorio")
  })

  it("uses the first value when Next supplies an array", () => {
    expect(parseView(["divergencias", "asistencia"], DEPUTY_VIEWS, "directorio")).toBe(
      "divergencias"
    )
  })
})

