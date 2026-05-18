"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"

interface SearchTriggerProps {
  variant?: "icon" | "pill"
  className?: string
}

export function SearchTrigger({ variant = "icon", className }: SearchTriggerProps) {
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        router.push("/buscar")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  if (variant === "pill") {
    return (
      <ResponsiveLink
        href="/buscar"
        aria-label="Buscar (⌘K)"
        title="Buscar (⌘K)"
        className={cn(
          "group inline-flex h-9 shrink-0 items-center gap-2 rounded border border-border bg-background/40 px-3 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:text-foreground",
          className
        )}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <span className="font-medium tracking-tight">Buscar</span>
        <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground/80 group-hover:text-muted-foreground sm:inline-flex">
          <span className="text-[11px] leading-none">⌘</span>
          <span className="leading-none">K</span>
        </kbd>
      </ResponsiveLink>
    )
  }

  return (
    <ResponsiveLink
      href="/buscar"
      aria-label="Buscar (⌘K)"
      title="Buscar (⌘K)"
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
    </ResponsiveLink>
  )
}
