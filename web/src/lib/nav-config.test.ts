import { describe, expect, it } from "vitest"
import { getSectionForPath, getSectionsByHub } from "./nav-config"

describe("section navigation", () => {
  it("uses canonical pages instead of hub query views", () => {
    const hrefs = getSectionsByHub().flatMap(({ sections }) =>
      sections.map((section) => section.href)
    )

    expect(hrefs).toContain("/calculadoras")
    expect(hrefs.some((href) => href.includes("?view="))).toBe(false)
  })

  it("resolves every standalone view as its own active section", () => {
    expect(getSectionForPath("/asistencia")?.key).toBe("asistencia")
    expect(getSectionForPath("/divergencias")?.key).toBe("divergencias")
    expect(getSectionForPath("/dinero-publico")?.key).toBe("dinero-publico")
    expect(getSectionForPath("/ccaa")?.key).toBe("ccaa")
    expect(getSectionForPath("/municipios")?.key).toBe("municipios")
    expect(getSectionForPath("/calculadoras")?.key).toBe("calculadoras")
  })
})
