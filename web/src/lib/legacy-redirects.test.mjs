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
      "/indicadores",
      "/calculadoras",
    ]) {
      expect(bySource.has(path)).toBe(false)
    }
  })

  it("collapses /ccaa and /municipios into the territorio hub via clean redirects", async () => {
    const redirects = await nextConfig.redirects()
    const bySource = new Map(redirects.map((redirect) => [redirect.source, redirect]))

    // Index pages collapse into the hub; detail pages keep their territory key.
    const expected = {
      "/ccaa": "/territorio",
      "/municipios": "/territorio",
      "/ccaa/:territory": "/territorio/ccaa/:territory",
      "/municipios/:territory": "/territorio/municipio/:territory",
    }

    for (const [source, destination] of Object.entries(expected)) {
      const redirect = bySource.get(source)
      expect(redirect, `missing redirect for ${source}`).toBeTruthy()
      expect(redirect.destination).toBe(destination)
      // Never redirect into a hub query view (the anti-pattern this suite guards).
      expect(redirect.destination.includes("?")).toBe(false)
      expect(redirect.permanent).toBe(true)
    }
  })
})
