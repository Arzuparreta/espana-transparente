import "server-only"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseFetch } from "./fetch"
import { guardPublicDataClient } from "./data-query-guard"

// Public data must never depend on cookies or refresh an Auth session. On the
// VPS, SUPABASE_INTERNAL_URL can bypass public DNS, TLS and the reverse proxy.
export const supabase = guardPublicDataClient(createClient(
  process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createSupabaseFetch(5_000) },
  },
))
