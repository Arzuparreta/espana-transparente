import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getSectionForPath, getSectionsByHub } from "./nav-config"

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../app")

describe("section navigation", () => {
  it("uses canonical pages instead of hub query views", () => {
    const hrefs = getSectionsByHub().flatMap(({ sections }) =>
      sections.map((section) => section.href)
    )

    expect(hrefs).toContain("/calculadoras")
    expect(hrefs.some((href) => href.includes("?view="))).toBe(false)
  })

  it("renders no nav section without a route page (every link must resolve)", () => {
    // Regression: the "Ministerios" nav link pointed at /ministerios, which had
    // only a [id] detail route and no index page.tsx — so the bare path 404'd.
    const navHrefs = getSectionsByHub().flatMap(({ sections }) =>
      sections.map((section) => section.href)
    )

    const missing = navHrefs.filter((href) => {
      if (!href.startsWith("/") || href.includes("?")) return false
      const segment = href.replace(/^\//, "")
      return !existsSync(resolve(APP_DIR, segment, "page.tsx"))
    })

    expect(missing).toEqual([])
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
