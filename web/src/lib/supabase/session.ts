import type { CookieOptionsWithName } from "@supabase/ssr"

export const SUPABASE_COOKIE_OPTIONS: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 400,
}

export const SUPABASE_AUTH_OPTIONS = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
}
