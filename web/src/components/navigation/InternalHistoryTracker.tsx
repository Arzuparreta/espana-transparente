"use client"
import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { getSectionForPath } from "@/lib/nav-config"
import { isLocalHref } from "@/lib/exploration"
export const INTERNAL_HISTORY_KEY = "espana-transparente.internal-history"
export const EXPLORATION_ORIGIN_KEY = "espana-transparente.exploration-origin"
export interface InternalHistoryItem {
  href: string
  pathname: string
  title?: string
  scrollY?: number
}
export function isCollectionPath(path: string) {
  return path === "/buscar" || getSectionForPath(path)?.href === path
}
export function InternalHistoryTracker() {
  const pathname = usePathname()
  const params = useSearchParams()
  useEffect(() => {
    const href = pathname + (params.size ? `?${params}` : "")
    try {
      const old = JSON.parse(
        sessionStorage.getItem(INTERNAL_HISTORY_KEY) ?? "[]",
      )
      sessionStorage.setItem(
        INTERNAL_HISTORY_KEY,
        JSON.stringify(
          [
            { href, pathname, title: document.title },
            ...(Array.isArray(old) ? old : []).filter(
              (x: InternalHistoryItem) => x.href !== href,
            ),
          ].slice(0, 20),
        ),
      )
      const origin = JSON.parse(
        sessionStorage.getItem(EXPLORATION_ORIGIN_KEY) ?? "null",
      )
      if (origin?.href === href && Number.isFinite(origin.scrollY))
        requestAnimationFrame(() => window.scrollTo(0, origin.scrollY))
    } catch {
      /* Storage is optional. */
    }
    const capture = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link = (event.target as Element)?.closest?.("a")
      if (!link || link.target === "_blank") return
      const target = link.getAttribute("href") ?? ""
      if (!isLocalHref(target)) return
      try {
        const targetPath = new URL(target, window.location.origin).pathname
        const origin = JSON.parse(
          sessionStorage.getItem(EXPLORATION_ORIGIN_KEY) ?? "null",
        )
        if (!isCollectionPath(pathname)) {
          if (Array.isArray(origin?.paths) && origin.paths.includes(pathname)) {
            sessionStorage.setItem(
              EXPLORATION_ORIGIN_KEY,
              JSON.stringify({
                ...origin,
                paths: [...new Set([...origin.paths, targetPath])],
              }),
            )
          }
          return
        }
        sessionStorage.setItem(
          EXPLORATION_ORIGIN_KEY,
          JSON.stringify({
            href,
            pathname,
            title: document.title.replace(/\s*\|.*$/, ""),
            scrollY: window.scrollY,
            paths: [targetPath],
          }),
        )
      } catch {
        /* Storage is optional. */
      }
    }
    document.addEventListener("click", capture, true)
    return () => document.removeEventListener("click", capture, true)
  }, [pathname, params])
  return null
}
