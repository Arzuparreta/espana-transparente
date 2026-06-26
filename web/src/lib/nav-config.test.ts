import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getSectionForPath, getSectionsByHub } from "./nav-config"
import { getThread } from "./thread-config"

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
    expect(getSectionForPath("/distorsion")?.key).toBe("distorsion")
    expect(getSectionForPath("/dinero-publico")?.key).toBe("dinero-publico")
    expect(getSectionForPath("/territorio")?.key).toBe("territorio")
    expect(getSectionForPath("/territorio/tu-zona")?.key).toBe("tu-zona")
    expect(getSectionForPath("/calculadoras")?.key).toBe("calculadoras")
  })

  it("surfaces electoral distortion under Personas decisions", () => {
    const personas = getThread("personas")
    const source = personas.sources.find((item) => item.href === "/distorsion")

    expect(source).toMatchObject({
      label: "Distorsión electoral",
      section: "Decisiones",
      icon: "distorsion",
    })

    const personasHub = getSectionsByHub().find((g) => g.hub.href === "/personas")
    expect(personasHub?.sections.map((s) => s.key)).toContain("distorsion")
  })

  it("resolves unified territorial detail routes to the territorio hub section", () => {
    // /ccaa and /municipios collapsed into /territorio/[scope]/[key]
    expect(getSectionForPath("/territorio/ccaa/ANDALUCIA")?.key).toBe("territorio")
    expect(getSectionForPath("/territorio/municipio/madrid")?.key).toBe("territorio")
  })

  it("groups the Territorio hub under its own label with Mapa + Tu zona sections", () => {
    const territorioHub = getSectionsByHub().find((g) => g.hub.href === "/territorio")
    expect(territorioHub?.hub.label).toBe("Territorio")
    expect(territorioHub?.sections.map((s) => s.key)).toEqual(["territorio", "tu-zona"])
    expect(territorioHub?.sections.every((s) => s.groupLabel === "Territorio")).toBe(true)
  })
})
