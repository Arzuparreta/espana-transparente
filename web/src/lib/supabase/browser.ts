import { createBrowserClient } from "@supabase/ssr"
import { SUPABASE_AUTH_OPTIONS, SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/session"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: SUPABASE_AUTH_OPTIONS,
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
    }
  )
}
