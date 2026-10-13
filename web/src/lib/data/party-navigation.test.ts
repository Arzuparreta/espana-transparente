import { beforeEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ rpc: vi.fn(), members: [{}] as unknown[] }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/public", () => ({ supabase: {
  from: (table: string) => {
    const result = table === "parties" ? { data: { id: "p", name: "Party", acronym: "P" }, error: null }
      : table === "politician_memberships" ? { data: mock.members, error: null }
      : table === "voting_sessions" ? { data: [{ id: "s", title: "Vote", date: "2026-09-30" }], error: null }
      : { data: null, error: null }
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: () => q,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(result).then(resolve) }
    return q
  }, rpc: mock.rpc,
} }))
import { getPartyVotingSessions } from "./parties"
beforeEach(() => { mock.members = [{}]; mock.rpc.mockReset().mockImplementation((name: string) => Promise.resolve({ data: name === "get_party_voting_tallies"
  ? [{ voting_session_id: "s", vote: "Sí", vote_count: 139 }]
  : [{ id: "s", divergence_count: 2 }], error: null })) })
it("uses complete SQL aggregates rather than fetching a truncated set of individual votes", async () => {
  expect((await getPartyVotingSessions("p"))[0]).toMatchObject({ partyVotes: { Sí: 139 }, divergence_count: 2 })
  expect(mock.rpc).toHaveBeenCalledWith("get_party_voting_tallies", { p_party_id: "p", p_session_ids: ["s"] })
})
it("preserves the empty recent-vote list for a party with no current Congress members", async () => {
  mock.members = []
  expect(await getPartyVotingSessions("p")).toEqual([])
  expect(mock.rpc).not.toHaveBeenCalled()
})
it("never converts failed party totals into zero votes", async () => {
  mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } })
  await expect(getPartyVotingSessions("p")).rejects.toThrow("timeout")
})
