import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import {
  selectDusProjects,
  summarizeDus,
  validateDusSnapshot,
  dusEuro,
} from "./prtr-program"
const sql = readFileSync(
  new URL(
    "../../../supabase/migrations/20261012130000_prtr_dus5000.sql",
    import.meta.url,
  ),
  "utf8",
)
export const seed = JSON.parse(
  sql.match(/VALUES \('DUS5000','(.+)'::jsonb\)/)![1].replace(/''/g, "'"),
)
it("validates one complete edition without conflating budgets grants and missing projects", () => {
  const s = validateDusSnapshot(seed)!
  expect(s).not.toBeNull()
  expect(s.summary.known_grant_cents).toBe(33690205836)
  expect(s.summary.zero_amounts).toBe(184)
  expect(s.summary.unknown_projects).toBe(106)
  expect(s.budget_cents).toBe(67500000000)
  expect(s.rows.some((r) => r.last_resolution.startsWith("2026"))).toBe(true)
  expect(dusEuro(null)).toBe("Importe no publicado")
  expect(dusEuro(0)).toContain("0,00")
})
it("rejects truncated or duplicated editions wrong phases dates totals and unsafe amounts", () => {
  const changes = [
    { ...seed, phase: "paid" },
    { ...seed, financing: "loan" },
    { ...seed, rows: seed.rows.slice(0, 10) },
    {
      ...seed,
      rows: seed.rows.map((r: unknown, i: number) =>
        i === 1 ? seed.rows[0] : r,
      ),
    },
    {
      ...seed,
      rows: seed.rows.map((r: object, i: number) =>
        i === 0 ? { ...r, last_resolution: "2025-02-30" } : r,
      ),
    },
    { ...seed, summary: { ...seed.summary, known_grant_cents: 1 } },
    { ...seed, territories: seed.territories.slice(1) },
    {
      ...seed,
      rows: seed.rows.map((r: object, i: number) =>
        i === 0 ? { ...r, grant_cents: Number.MAX_SAFE_INTEGER + 1 } : r,
      ),
    },
  ]
  for (const s of changes) expect(validateDusSnapshot(s)).toBeNull()
})
it("filters only supported territory and published project fields and reconciles each result", () => {
  const s = validateDusSnapshot(seed)!
  expect(selectDusProjects(s, "", "")).toHaveLength(1358)
  const rows = selectDusProjects(s, "13", "ajalvir")!
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.every((r) => r.territory === "13")).toBe(true)
  expect(summarizeDus(rows).records).toBe(rows.length)
  expect(selectDusProjects(s, "99")).toBeNull()
  expect(selectDusProjects(s, ["01", "13"])).toBeNull()
  expect(selectDusProjects(s, undefined, ["query"])).toBeNull()
  expect(selectDusProjects(s, "01", "x".repeat(121))).toBeNull()
})
