import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createSupabaseFetch } from "@/lib/supabase/fetch"
import { SUPABASE_AUTH_OPTIONS, SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/session"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: SUPABASE_AUTH_OPTIONS,
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      global: {
        fetch: createSupabaseFetch(),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Server Components cannot always write cookies. Middleware refreshes sessions.
            }
          })
        },
      },
    }
  )
}
