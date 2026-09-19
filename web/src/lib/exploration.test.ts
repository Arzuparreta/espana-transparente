import { describe, it, expect } from "vitest"
import { collectionHref, isLocalHref } from "./exploration"
import {
  getAreaForPath,
  getSectionForPath,
  getSectionsByHub,
} from "./nav-config"
describe("exploration continuity", () => {
  it("keeps municipal recipient filters through paging and type changes", () => {
    const input =
      "municipio=28079&province=28&flow=to&year=2024&organization=abc&role=recipient&page=3"
    const url = collectionHref("/contratos", input, { type: "Obras", page: 1 })
    expect(url).toContain("municipio=28079")
    expect(url).toContain("flow=to")
    expect(url).toContain("role=recipient")
    expect(url).not.toContain("page=")
    expect(
      collectionHref("/contratos", url.split("?")[1], { page: 2 }),
    ).toContain("page=2")
  })
  it("removes only the requested filter", () =>
    expect(
      collectionHref(
        "/subvenciones",
        "nivel=LOCAL&municipio=28079&flow=to&year=2024",
        { year: null, page: 1 },
      ),
    ).toBe("/subvenciones?nivel=LOCAL&municipio=28079&flow=to"))
  it("rejects external and protocol-relative return targets", () => {
    expect(isLocalHref("//evil.test")).toBe(false)
    expect(isLocalHref("/\\evil.test")).toBe(false)
    expect(isLocalHref("/contratos?page=2")).toBe(true)
  })
  it("assigns deep routes to canonical areas", () => {
    expect(getAreaForPath("/senadores/123")?.key).toBe("personas")
    expect(getAreaForPath("/cargos/123")?.key).toBe("personas")
    expect(getAreaForPath("/rastro/organizacion/123")?.key).toBe("personas")
    expect(getAreaForPath("/indicadores/DEUDA_PUBLICA")?.key).toBe("dinero")
    expect(getSectionForPath("/presupuestos/12/123")?.href).toBe(
      "/presupuestos",
    )
  })
  it("lists each collection once", () => {
    const paths = getSectionsByHub().flatMap((g) =>
      g.sections.map((s) => s.href),
    )
    expect(new Set(paths).size).toBe(paths.length)
  })
})
