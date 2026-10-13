"use client"

import { type AnchorHTMLAttributes, useEffect, useRef, useTransition } from "react"
import Link, { type LinkProps } from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// One transition owner survives page unmounts and overlapping navigations.
let navigate: ((href: string, replace?: boolean, scroll?: boolean) => void) | null = null

export function NavigationProgress() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    navigate = (href, replace, scroll) => {
      startTransition(() => {
        if (replace) router.replace(href, { scroll })
        else router.push(href, { scroll })
      })
    }
    return () => { navigate = null }
  }, [router])

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-primary transition-transform duration-200 motion-reduce:transition-none",
        isPending ? "scale-x-100" : "scale-x-0"
      )}
    />
  )
}

type ResponsiveLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    prefetchOnIntent?: boolean
  }

export function ResponsiveLink({
  href,
  className,
  prefetch = null,
  prefetchOnIntent = true,
  onNavigate,
  onPointerEnter,
  onFocus,
  onPointerLeave,
  replace,
  scroll,
  ...props
}: ResponsiveLinkProps) {
  const router = useRouter()
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function cancelIntent() {
    if (intentTimer.current) clearTimeout(intentTimer.current)
    intentTimer.current = null
  }
  useEffect(() => cancelIntent, [href])
  const isInternal = typeof href === "string" && href.startsWith("/") && !href.startsWith("//")

  function prefetchTarget() {
    if (!isInternal || !prefetchOnIntent) return
    router.prefetch(href as string)
  }

  return (
    <Link
      href={href}
      replace={replace}
      scroll={scroll}
      prefetch={prefetch}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (event.pointerType === "touch" || event.defaultPrevented) return
        cancelIntent()
        intentTimer.current = setTimeout(prefetchTarget, 120)
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        cancelIntent()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        if (!event.defaultPrevented) prefetchTarget()
      }}
      onNavigate={(event) => {
        // Next invokes this only for actual same-tab client navigations (not
        // Ctrl/Cmd-click, downloads or external URLs). Preserve caller vetoes.
        let prevented = false
        onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault() } })
        if (prevented || !isInternal || !navigate) return
        const target = new URL(href as string, window.location.href)
        if (target.pathname === window.location.pathname && target.search === window.location.search) return
        event.preventDefault()
        navigate(href as string, replace, scroll)
      }}
      className={className}
      {...props}
    />
  )
}
