"use client"

import {
  type AnchorHTMLAttributes,
  useEffect,
  useState,
  useTransition,
} from "react"
import Link, { type LinkProps } from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

let startProgress: (() => void) | null = null
let stopProgress: (() => void) | null = null

export function NavigationProgress() {
  const pathname = usePathname()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    startProgress = () => setIsNavigating(true)
    stopProgress = () => setIsNavigating(false)

    return () => {
      startProgress = null
      stopProgress = null
    }
  }, [])

  useEffect(() => {
    setIsNavigating(false)
  }, [pathname])

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-x-0 top-0 z-[70] h-0.5 origin-left bg-primary transition-transform duration-200",
        isNavigating ? "scale-x-100" : "scale-x-0"
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
  prefetch = false,
  prefetchOnIntent = true,
  onClick,
  onPointerEnter,
  onFocus,
  ...props
}: ResponsiveLinkProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isInternal = typeof href === "string" && href.startsWith("/")

  function prefetchTarget() {
    if (!isInternal || !prefetchOnIntent) return
    startTransition(() => router.prefetch(href as string))
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (event.pointerType === "touch") return
        prefetchTarget()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        prefetchTarget()
      }}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && isInternal) {
          startProgress?.()
          window.setTimeout(() => stopProgress?.(), 1800)
        }
      }}
      className={cn(
        "transition-opacity data-[pending=true]:opacity-70",
        className
      )}
      data-pending={isPending ? "true" : undefined}
      {...props}
    />
  )
}
