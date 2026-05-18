"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

interface Props {
  initialQuery?: string
  autoFocus?: boolean
  compact?: boolean
}

export function SearchForm({ initialQuery = "", autoFocus = false, compact = false }: Props) {
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
    <form onSubmit={handleSubmit} role="search" className={compact ? "" : "w-full"}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Pregunta por personas, votaciones, contratos, subvenciones, presupuestos o indicadores"
            aria-label="Buscar"
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-border/70 bg-card/80 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-border/70 bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Buscar
        </button>
      </div>
    </form>
  )
}
