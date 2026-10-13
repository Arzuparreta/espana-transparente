import { expect, it, vi } from "vitest"
const rpc = vi.hoisted(() => vi.fn())
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("@/lib/supabase/public", () => ({ supabase: { rpc } }))
import { getSenateNominalVoteStats } from "./senado"
it("reads actual vote/session counts without the whole-corpus divergence view", async () => {
  rpc.mockResolvedValueOnce({ data: [{ sessions_with_votes: 10, vote_rows: 2300 }], error: null })
  expect(await getSenateNominalVoteStats()).toEqual({ sessionsWithVotes: 10, voteRows: 2300 })
  expect(rpc).toHaveBeenCalledWith("get_senate_nominal_vote_stats")
})
it("does not cache a failed count as zero", async () => {
  rpc.mockResolvedValueOnce({ data: null, error: { message: "timeout" } })
  await expect(getSenateNominalVoteStats()).rejects.toThrow("timeout")
  rpc.mockResolvedValueOnce({ data: [], error: null })
  await expect(getSenateNominalVoteStats()).rejects.toThrow("Missing Senate")
})
