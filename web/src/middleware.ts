import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { SUPABASE_AUTH_OPTIONS, SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/session"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const hasAuthSession = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"))

  // Anonymous public traffic does not need an Auth round-trip. This keeps the
  // data portal available when Supabase Auth is degraded and reduces load.
  if (!hasAuthSession) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: SUPABASE_AUTH_OPTIONS,
      cookieOptions: SUPABASE_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|apple-touch-icon.png|icons|brand|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
