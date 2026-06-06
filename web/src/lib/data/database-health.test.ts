import { afterEach, describe, expect, it, vi } from "vitest"
import { checkDatabaseHealth } from "./database-health"

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

afterEach(() => {
  vi.unstubAllGlobals()
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
})

describe("checkDatabaseHealth", () => {
  it("performs an uncached REST read", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('[{"pipeline":"attendance"}]', { status: 200 }))
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(checkDatabaseHealth()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/v_etl_pipeline_status?select=pipeline&limit=1",
      expect.objectContaining({
        cache: "no-store",
        headers: {
          apikey: "anon-key",
          Authorization: "Bearer anon-key",
        },
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co/rest/v1/v_attendance_ranking?select=politician_id&limit=1",
      expect.objectContaining({ cache: "no-store" })
    )
  })

  it("fails when any critical data path returns a gateway error", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key"
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(new Response("[]", { status: 200 }))
        .mockResolvedValueOnce(new Response("gateway timeout", { status: 522 }))
    )

    await expect(checkDatabaseHealth()).rejects.toThrow(
      "v_attendance_ranking?select=politician_id&limit=1 returned 522"
    )
  })
})
