import { afterEach, expect, it, vi } from "vitest"
import { createServerSupabaseFetch } from "./server-fetch"
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it("uses loopback transport while preserving method, headers and the public cookie namespace URL", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.com/supabase")
  vi.stubEnv("SUPABASE_INTERNAL_URL", "http://127.0.0.1:54321")
  const fetch = vi.fn().mockResolvedValue(new Response("{}"))
  vi.stubGlobal("fetch", fetch)
  const transport = createServerSupabaseFetch()
  await transport("https://example.com/supabase/auth/v1/user?test=1", { headers: { Authorization: "Bearer test" }, method: "GET" })
  expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:54321/auth/v1/user?test=1", expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer test" } }))
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.com/supabase")
})
it("does not redirect unrelated origins or URL prefixes", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.com/supabase")
  vi.stubEnv("SUPABASE_INTERNAL_URL", "http://127.0.0.1:54321")
  const fetch = vi.fn().mockResolvedValue(new Response("{}"))
  vi.stubGlobal("fetch", fetch)
  const transport = createServerSupabaseFetch()
  await transport("https://other.com/supabase/auth/v1/user")
  await transport("https://example.com/supabase-other/auth/v1/user")
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(["https://other.com/supabase/auth/v1/user", "https://example.com/supabase-other/auth/v1/user"])
})
