import { beforeEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ rpc: vi.fn(), rows: [{ id: "a", title: "Vote" }], count: 1 }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/public", () => ({ supabase: {
  from: () => {
    const query = { select: () => query, order: () => query, range: () => query,
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: mock.rows, count: mock.count, error: null }).then(resolve) }
    return query
  }, rpc: mock.rpc,
} }))
import { getVotingSessionPage } from "./voting"
beforeEach(() => {
  mock.rows = [{ id: "a", title: "Vote" }]; mock.count = 1
  mock.rpc.mockReset().mockResolvedValue({ data: [{ id: "a", vote_count: 3, votes_yes: 2, votes_no: 1, votes_abstain: 0, divergence_count: 1 }], error: null })
})
it("enriches only the requested page with exact tallies", async () => {
  const result = await getVotingSessionPage(1)
  expect(mock.rpc).toHaveBeenCalledWith("get_voting_session_tallies", { p_session_ids: ["a"] })
  expect(result.sessions[0]).toMatchObject({ votes_yes: 2, votes_no: 1, divergence_count: 1 })
})
it("never caches a failed or incomplete tally request as zero results", async () => {
  mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "statement timeout" } })
  await expect(getVotingSessionPage(1)).rejects.toThrow("statement timeout")
  mock.rpc.mockResolvedValueOnce({ data: [], error: null })
  await expect(getVotingSessionPage(1)).rejects.toThrow("Incomplete voting session tallies")
  expect((await getVotingSessionPage(1)).sessions[0].votes_yes).toBe(2)
})
it("does not run aggregate queries for an empty page", async () => {
  mock.rows = []; mock.count = 0
  expect((await getVotingSessionPage(1)).sessions).toEqual([])
  expect(mock.rpc).not.toHaveBeenCalled()
})
