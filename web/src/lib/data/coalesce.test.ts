import { expect, it, vi } from "vitest"
import { coalesceRequests } from "./coalesce"
it("shares concurrent misses for the same arguments but keeps different pages independent", async () => {
  const fn = vi.fn(async (page: number) => page)
  const read = coalesceRequests(fn)
  expect(await Promise.all([read(1), read(1), read(2)])).toEqual([1, 1, 2])
  expect(fn).toHaveBeenCalledTimes(2)
  await read(1)
  expect(fn).toHaveBeenCalledTimes(3)
})
it("releases failures so a later request can recover", async () => {
  const fn = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("ok")
  const read = coalesceRequests(fn)
  const results = await Promise.allSettled([read("id"), read("id")])
  expect(results.every((result) => result.status === "rejected")).toBe(true)
  expect(fn).toHaveBeenCalledOnce()
  expect(await read("id")).toBe("ok")
})
