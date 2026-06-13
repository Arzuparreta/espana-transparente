import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config.mjs"

describe("legacy index redirects", () => {
  it("does not redirect canonical section pages into hub query views", async () => {
    const redirects = await nextConfig.redirects()
    const bySource = new Map(redirects.map((redirect) => [redirect.source, redirect]))

    for (const path of [
      "/asistencia",
      "/divergencias",
      "/dinero-publico",
      "/ccaa",
      "/municipios",
      "/indicadores",
      "/calculadoras",
    ]) {
      expect(bySource.has(path)).toBe(false)
    }
  })
})
