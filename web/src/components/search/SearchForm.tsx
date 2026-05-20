"use client"

import { ArrowRight, Loader2, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"
import type { SearchResult } from "@/lib/data"

interface Props {
  initialQuery?: string
  autoFocus?: boolean
  compact?: boolean
  size?: "default" | "hero"
  className?: string
  live?: boolean
}

type SuggestPayload = {
  results: SearchResult[]
}

const TYPE_LABEL: Record<SearchResult["entity_type"], string> = {
  politician: "Diputados",
  senator: "Senado",
  party: "Partidos",
  government_position: "Gobierno",
  institution: "Instituciones",
  organization: "Organizaciones",
  voting_session: "Votaciones",
  vote_divergence: "Divergencias",
  contract: "Contratos",
  subsidy: "Subvenciones",
  initiative: "Iniciativas",
  budget: "Presupuestos",
  budget_program: "Programas",
  indicator: "Indicadores",
  eu_fund: "Fondos UE",
  revolving_door: "Puertas giratorias",
  source_document: "Fuentes",
}

function formatAmount(value?: number | null) {
  if (typeof value !== "number") return null
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function SearchForm({
  initialQuery = "",
  autoFocus = false,
  compact = false,
  size = "default",
  className,
  live = false,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLFormElement>(null)
  const meaningful = value.trim().length >= 2
  const showButton = size !== "hero"

  useEffect(() => {
    setValue(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    if (!live) return
    const q = value.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&limit=12`, {
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = (await response.json()) as SuggestPayload
        setResults(payload.results ?? [])
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 140)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [live, value])

  useEffect(() => {
    if (!live) return
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [live])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (q.length >= 2) {
      router.push(`/buscar?q=${encodeURIComponent(q)}`)
      setOpen(false)
    }
  }

  const grouped = useMemo(() => {
    const groups = new Map<SearchResult["entity_type"], SearchResult[]>()
    for (const result of results) {
      groups.set(result.entity_type, [...(groups.get(result.entity_type) ?? []), result])
    }
    return Array.from(groups.entries()).map(([type, groupResults]) => ({
      type,
      label: TYPE_LABEL[type],
      results: groupResults,
    }))
  }, [results])

  return (
    <form
      ref={rootRef}
      onSubmit={handleSubmit}
      role="search"
      className={cn("relative", compact ? "" : "w-full", className)}
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          {live && loading ? (
            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          ) : null}
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Busca diputados, votaciones, contratos…"
            aria-label="Buscar"
            aria-busy={live ? loading : undefined}
            autoComplete="off"
            className={cn(
              "w-full rounded border border-border/70 bg-card/80 pl-9 pr-3 outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
              live && loading ? "pr-9" : "",
              size === "hero" ? "h-12 text-base sm:text-lg" : "h-10 text-sm"
            )}
          />
        </div>
        {showButton ? (
          <button
            type="submit"
            className="h-10 shrink-0 rounded border border-border/70 bg-card px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Buscar
          </button>
        ) : null}
      </div>

      {live && open && meaningful ? (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded border border-border bg-card text-left shadow-lg">
          {grouped.length > 0 ? (
            <div className="max-h-[28rem] overflow-y-auto p-2">
              {grouped.map((group) => (
                <section key={group.type} className="py-1">
                  <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </h2>
                  <div className="space-y-1">
                    {group.results.map((result) => {
                      const meta = [formatDate(result.document_date), formatAmount(result.amount)].filter(Boolean).join(" · ")
                      const secondary =
                        result.official_name && result.official_name !== result.title
                          ? result.official_name
                          : result.key_fact ?? result.subtitle
                      return (
                        <ResponsiveLink
                          key={`${result.entity_type}-${result.id}`}
                          href={result.url}
                          className="block rounded border border-transparent px-3 py-2 transition-colors hover:border-border/70 hover:bg-muted/60"
                          onClick={() => setOpen(false)}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{result.title}</p>
                              {secondary ? (
                                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{secondary}</p>
                              ) : null}
                            </div>
                            {meta ? (
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span>
                            ) : null}
                          </div>
                        </ResponsiveLink>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {loading ? "Buscando…" : "Sin coincidencias directas."}
            </p>
          )}
          <button
            type="submit"
            className="flex w-full items-center justify-between gap-3 border-t border-border px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-muted"
          >
            <span className="truncate">Ver todos los resultados para: {value.trim()}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        </div>
      ) : null}
    </form>
  )
}
