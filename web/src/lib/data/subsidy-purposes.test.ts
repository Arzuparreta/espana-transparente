import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  result: { data: [] as unknown[] | null, error: null as unknown },
}))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}))
import { getSubsidyPurposeYear, getBdnsCall } from "./subsidy-purposes"
beforeEach(() => {
  mocks.rpc.mockReset()
  mocks.from.mockReset()
  mocks.result = { data: [], error: null }
  const query = {
    limit: () => query,
    abortSignal: () => query,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(mocks.result).then(resolve),
  }
  mocks.rpc.mockReturnValue(query)
})
it("distinguishes empty corpus from errors and truncation", async () => {
  expect(await getSubsidyPurposeYear(2024)).toEqual({
    groups: [],
    error: false,
  })
  mocks.result = { data: null, error: { message: "statement timeout" } }
  expect((await getSubsidyPurposeYear(2024)).error).toBe(true)
  mocks.result = { data: Array(1000).fill({}), error: null }
  expect((await getSubsidyPurposeYear(2024)).error).toBe(true)
})
it("rejects invalid years before querying and absent call codes before lookup", async () => {
  expect((await getSubsidyPurposeYear(2013)).error).toBe(true)
  expect(mocks.rpc).not.toHaveBeenCalled()
  expect(await getBdnsCall(null)).toEqual({ call: null, error: false })
  expect(await getBdnsCall("88junk")).toEqual({ call: null, error: false })
  expect(mocks.from).not.toHaveBeenCalled()
})
it("keeps a failed call query distinct from a pending call", async () => {
  const query = { select: () => query, eq: () => query, abortSignal: () => query,
    maybeSingle: async () => ({ data: null, error: { message: "call lookup unavailable" } }) }
  mocks.from.mockReturnValue(query)
  expect(await getBdnsCall("877378")).toEqual({ call: null, error: true })
})
