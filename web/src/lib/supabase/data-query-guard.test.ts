import { describe, expect, it, vi } from "vitest"

import {
  guardDataQuery,
  guardPublicDataClient,
  isDataSourceUnavailable,
} from "./data-query-guard"

function queryResult(result: unknown) {
  return {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    select() {
      return this
    },
    order() {
      return this
    },
  }
}

describe("public data query guard", () => {
  it("recognizes hosted database outages", () => {
    expect(isDataSourceUnavailable({ message: "<!DOCTYPE html>", status: 522 })).toBe(true)
    expect(isDataSourceUnavailable({ code: "PGRST002", message: "Could not query the database" })).toBe(true)
    expect(isDataSourceUnavailable(new Error("connection timed out"))).toBe(true)
    expect(isDataSourceUnavailable(new DOMException("The operation was aborted due to timeout", "TimeoutError"))).toBe(true)
  })

  it("does not classify normal query errors as an infrastructure outage", () => {
    expect(isDataSourceUnavailable({ code: "PGRST116", message: "JSON object requested, multiple rows returned" })).toBe(false)
  })

  it("throws before an unavailable result can be converted into an empty list", async () => {
    const query = guardDataQuery(queryResult({
      data: null,
      error: { message: "<!DOCTYPE html><title>522</title>", status: 522 },
    }))

    await expect(query.select().order()).rejects.toThrow("Public data source unavailable")
  })

  it("preserves successful and ordinary error results", async () => {
    await expect(guardDataQuery(queryResult({ data: [{ id: 1 }], error: null }))).resolves.toEqual({
      data: [{ id: 1 }],
      error: null,
    })
    await expect(guardDataQuery(queryResult({
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    }))).resolves.toMatchObject({
      error: { code: "PGRST116" },
    })
  })

  it("guards from and rpc queries without changing auth methods", async () => {
    const auth = { signOut: vi.fn() }
    const client = guardPublicDataClient<{
      auth: typeof auth
      from: (table: string) => ReturnType<typeof queryResult>
      rpc: (fn: string) => ReturnType<typeof queryResult>
    }>({
      auth,
      from: vi.fn(() => queryResult({ data: null, error: { status: 503 } })),
      rpc: vi.fn(() => queryResult({ data: [], error: null })),
    })

    expect(client.auth).toBe(auth)
    await expect(client.from("records")).rejects.toThrow("Public data source unavailable")
    await expect(client.rpc("records")).resolves.toMatchObject({ data: [] })
  })
})
