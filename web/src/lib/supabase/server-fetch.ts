import { createSupabaseFetch } from "./fetch"

// Keep the public URL in SSR clients (it determines the Auth cookie namespace),
// but send requests to the verified same-instance loopback endpoint on the VPS.
export function createServerSupabaseFetch(): typeof fetch {
  const boundedFetch = createSupabaseFetch()
  const internal = process.env.SUPABASE_INTERNAL_URL
  const external = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!internal || !external) return boundedFetch
  const publicUrl = new URL(external)
  const internalUrl = new URL(internal)
  return (input, init) => {
    if (typeof input === "string" || input instanceof URL) {
      const target = new URL(input)
      const prefix = publicUrl.pathname.replace(/\/$/, "")
      if (target.origin === publicUrl.origin && target.pathname.startsWith(`${prefix}/`)) {
        const path = target.pathname.slice(prefix.length)
        target.protocol = internalUrl.protocol
        target.host = internalUrl.host
        target.pathname = internalUrl.pathname.replace(/\/$/, "") + path
        return boundedFetch(target.toString(), init)
      }
    }
    return boundedFetch(input, init)
  }
}
