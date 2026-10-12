import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  result: { data: [] as unknown[] | null, error: null as unknown },
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { getAutonomicLiquidation } from "./autonomic-liquidation";
beforeEach(() => {
  mocks.result = { data: [], error: null };
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    abortSignal: () => query,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(mocks.result).then(resolve),
  };
  mocks.from.mockReturnValue(query);
});
it("does not replace a query failure or truncated response with an empty report", async () => {
  expect((await getAutonomicLiquidation()).error).toBe(false);
  mocks.result = { data: null, error: { message: "statement timeout" } };
  expect((await getAutonomicLiquidation()).error).toBe(true);
  mocks.result = { data: Array(1000).fill({}), error: null };
  expect((await getAutonomicLiquidation()).error).toBe(true);
});
