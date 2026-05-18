"use client"

import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface Props {
  initialQuery?: string
  autoFocus?: boolean
  compact?: boolean
  size?: "default" | "hero"
  className?: string
}

export function SearchForm({
  initialQuery = "",
  autoFocus = false,
  compact = false,
  size = "default",
  className,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (q.length >= 2) {
      router.push(`/buscar?q=${encodeURIComponent(q)}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={cn(compact ? "" : "w-full", className)}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Pregunta por personas, votaciones, contratos, subvenciones, presupuestos o indicadores"
            aria-label="Buscar"
            autoComplete="off"
            className={cn(
              "w-full rounded border border-border/70 bg-card/80 pl-9 pr-3 outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
              size === "hero" ? "h-12 text-base sm:text-lg" : "h-10 text-sm"
            )}
          />
        </div>
        <button
          type="submit"
          className={cn(
            "shrink-0 rounded border border-border/70 bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            size === "hero" ? "h-12" : "h-10"
          )}
        >
          Buscar
        </button>
      </div>
    </form>
  )
}
