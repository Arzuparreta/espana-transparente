"use client"

import { Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { SearchForm } from "@/components/search/SearchForm"
import { cn } from "@/lib/utils"

interface SearchTriggerProps {
  variant?: "icon" | "pill"
  className?: string
}

export function SearchTrigger({ variant = "icon", className }: SearchTriggerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
        return
      }
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const triggerClassName =
    variant === "pill"
      ? "group inline-flex h-9 shrink-0 items-center gap-2 rounded border border-border bg-background/40 px-3 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:text-foreground data-[open=true]:border-foreground/30 data-[open=true]:bg-muted data-[open=true]:text-foreground"
      : "grid h-8 w-8 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground data-[open=true]:text-foreground"

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Buscar (⌘K)"
        title="Buscar (⌘K)"
        aria-expanded={open}
        data-open={open}
        className={cn(triggerClassName, className)}
        onClick={() => setOpen((current) => !current)}
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {variant === "pill" ? (
          <>
            <span className="font-medium tracking-tight">Buscar</span>
            <kbd className="ml-2 hidden items-center gap-0.5 rounded border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground/80 group-hover:text-muted-foreground sm:inline-flex">
              <span className="text-[11px] leading-none">⌘</span>
              <span className="leading-none">K</span>
            </kbd>
          </>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(30rem,calc(100vw-2rem))] rounded border border-border bg-card p-2 shadow-lg">
          <SearchForm autoFocus compact live className="w-full" />
        </div>
      ) : null}
    </div>
  )
}
