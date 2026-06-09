import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config.mjs"

describe("legacy index redirects", () => {
  it("points absorbed indexes at their canonical hub views", async () => {
    const redirects = await nextConfig.redirects()
    const bySource = new Map(redirects.map((redirect) => [redirect.source, redirect]))

    expect(bySource.get("/asistencia")).toMatchObject({
      destination: "/diputados?view=asistencia",
      permanent: true,
    })
    expect(bySource.get("/divergencias")).toMatchObject({
      destination: "/diputados?view=divergencias",
      permanent: true,
    })
    expect(bySource.get("/dinero-publico")).toMatchObject({
      destination: "/dinero?view=trazabilidad",
      permanent: true,
    })
    expect(bySource.get("/indicadores")).toMatchObject({
      destination: "/economia?view=series",
      permanent: true,
    })
    expect(bySource.get("/ccaa")).toMatchObject({
      destination: "/territorio?view=autonomico",
      permanent: true,
    })
    expect(bySource.get("/municipios")).toMatchObject({
      destination: "/territorio?view=municipal",
      permanent: true,
    })
  })
})
