import { beforeEach, expect, it, vi } from "vitest";
import { sectorRows } from "../fiscal-sector-fixtures";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  result: { data: [] as unknown[] | null, error: null as unknown },
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { getFiscalSectors } from "./fiscal-sectors";
beforeEach(() => {
  mocks.result = { data: sectorRows(), error: null };
  const query = {
    select: () => query,
    eq: () => query,
    gte: () => query,
    order: () => query,
    limit: () => query,
    abortSignal: () => query,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(mocks.result).then(resolve),
  };
  mocks.from.mockReturnValue(query);
});
it("publishes validated scope while rejecting inconsistent rows", async () => {
  expect((await getFiscalSectors()).years).toHaveLength(1);
  mocks.result.data = sectorRows().slice(1);
  expect(await getFiscalSectors()).toEqual({
    years: [],
    rejectedYears: [2024],
    error: false,
  });
});
it("never disguises failed or truncated data as zero or missing", async () => {
  mocks.result = { data: null, error: { message: "statement timeout" } };
  expect((await getFiscalSectors()).error).toBe(true);
  mocks.result = { data: Array(1500).fill({}), error: null };
  expect((await getFiscalSectors()).error).toBe(true);
});
