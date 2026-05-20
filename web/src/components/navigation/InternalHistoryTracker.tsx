"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export const INTERNAL_HISTORY_KEY = "espana-transparente.internal-history"
const MAX_HISTORY_ITEMS = 5

export interface InternalHistoryItem {
  href: string
  pathname: string
  title?: string
}

function readHistory(): InternalHistoryItem[] {
  try {
    const raw = window.sessionStorage.getItem(INTERNAL_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isHistoryItem).slice(0, MAX_HISTORY_ITEMS) : []
  } catch {
    return []
  }
}

function isHistoryItem(value: unknown): value is InternalHistoryItem {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<InternalHistoryItem>
  return typeof item.href === "string" && typeof item.pathname === "string"
}

function writeHistory(items: InternalHistoryItem[]) {
  try {
    window.sessionStorage.setItem(INTERNAL_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)))
  } catch {
    // Navigation history is an enhancement; blocked storage should not affect page rendering.
  }
}

export function InternalHistoryTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const query = searchParams.toString()
    const href = query ? `${pathname}?${query}` : pathname
    const history = readHistory().filter((item) => item.href !== href)

    writeHistory([
      {
        href,
        pathname,
        title: document.title.replace(/\s*\|\s*España Transparente\s*$/, ""),
      },
      ...history,
    ])
  }, [pathname, searchParams])

  return null
}
