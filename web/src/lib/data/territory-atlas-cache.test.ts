import { expect, it, vi } from "vitest"
const calls = vi.hoisted(() => [] as Array<[string, string, string[]]>)
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/public", () => ({ supabase: { from: (table: string) => {
  const rows = table === "territory_catalog" ? [
    { territory_key: "ccaa-01", territory_name: "Andalucía", territory_type: "ccaa" },
    { territory_key: "province-04", territory_name: "Almería", territory_type: "province" },
  ] : []
  const q = {
    select: () => q, order: () => q, range: () => q,
    in: (column: string, values: string[]) => { calls.push([table, column, values]); return q },
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
  }
  return q
} } }))
import { getTerritoryAtlas } from "./multilevel"
it("loads only map territories and their population, preserving the complete spend query", async () => {
  const data = await getTerritoryAtlas()
  expect(data.territories).toHaveLength(2)
  expect(calls).toContainEqual(["territory_catalog", "territory_type", ["ccaa", "province"]])
  expect(calls).toContainEqual(["territory_population", "territory_key", ["ccaa-01", "province-04"]])
  expect(calls.some(([table]) => table === "v_territory_spend_yearly")).toBe(false)
})
