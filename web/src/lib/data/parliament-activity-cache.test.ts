import { expect, it, vi } from "vitest"
import { activityFixture } from "@/lib/parliament-activity-fixtures"
const mock = vi.hoisted(() => ({ fail: true, reads: 0 }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => {
  const cache = new Map<string, unknown>()
  return async (...args: unknown[]) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) return cache.get(key)
    const result = await fn(...args)
    cache.set(key, result)
    return result
  }
} }))
vi.mock("@/lib/supabase/client", () => ({ supabase: { from: (table: string) => {
  mock.reads++
  const fixture = activityFixture()
  const result = mock.fail ? { data: null, error: { message: "transient gateway" } } : { data: table === "parliament_activity_coverage" ? { metadata: fixture.coverage } : fixture.rows, error: null }
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, gte: () => q, lt: () => q, abortSignal: () => q, maybeSingle: () => q, then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) }
  return q
} } }))
import { getParliamentActivity } from "./parliament-activity"
it("retries after a transient failure while retaining successful validated caching", async () => {
  expect((await getParliamentActivity("2024")).error).toBe(true)
  mock.fail = false
  expect((await getParliamentActivity("2024")).rows).toHaveLength(2)
  const reads = mock.reads
  expect((await getParliamentActivity("2024")).rows).toHaveLength(2)
  expect(mock.reads).toBe(reads)
})
