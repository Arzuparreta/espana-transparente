"use client"

import { ArrowRight, Loader2, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { cn } from "@/lib/utils"
import type { SearchResult } from "@/lib/data"

type SearchPayload = {
  citations: {
    title: string
    url: string
    entityType: SearchResult["entity_type"]
    sourceUrl: string | null
  }[]
  resultCards: SearchResult[]
  suggestedFilters: {
    id: string
    label: string
    entityTypes: SearchResult["entity_type"][]
  }[]
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

const TYPE_ORDER: SearchResult["entity_type"][] = [
  "politician",
  "senator",
  "government_position",
  "institution",
  "vote_divergence",
  "voting_session",
  "initiative",
  "contract",
  "subsidy",
  "budget",
  "budget_program",
  "indicator",
  "organization",
  "party",
  "eu_fund",
  "revolving_door",
  "source_document",
]

interface SmartSearchProps {
  initialQuery?: string
  initialResults?: SearchResult[]
  mode?: "hero" | "page"
  autoFocus?: boolean
}

function groupedResults(results: SearchResult[]) {
  const byType = new Map<SearchResult["entity_type"], SearchResult[]>()
  for (const result of results) {
    byType.set(result.entity_type, [...(byType.get(result.entity_type) ?? []), result])
  }
  return TYPE_ORDER.filter((type) => byType.has(type)).map((type) => ({
    type,
    label: TYPE_LABEL[type],
    results: byType.get(type) ?? [],
  }))
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

function ResultCard({ result, compact = false }: { result: SearchResult; compact?: boolean }) {
  const detail = result.key_fact ?? result.subtitle
  const meta = [formatDate(result.document_date), formatAmount(result.amount)].filter(Boolean).join(" · ")
  const href = result.url || result.source_url || "/buscar"

  return (
    <ResponsiveLink
      href={href}
      className={cn(
        "block min-w-0 rounded border border-border/70 bg-card/80 transition-colors hover:border-foreground/25 hover:bg-card",
        compact ? "px-3 py-2" : "px-4 py-3"
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{result.title}</p>
          {detail ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        <span className="shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {TYPE_LABEL[result.entity_type]}
        </span>
      </div>
      {meta ? <p className="mt-2 text-xs tabular-nums text-muted-foreground">{meta}</p> : null}
    </ResponsiveLink>
  )
}

export function SmartSearch({ initialQuery = "", initialResults = [], mode = "hero", autoFocus = false }: SmartSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchResult[]>(initialResults)
  const [filters, setFilters] = useState<SearchPayload["suggestedFilters"]>([])
  const [pageResults, setPageResults] = useState<SearchResult[]>(initialResults)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [isNavigating, startNavigation] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isPage = mode === "page"

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      setPageResults([])
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoadingSuggestions(true)
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit: isPage ? 18 : 10 }),
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = (await response.json()) as SearchPayload
        setSuggestions(payload.resultCards ?? [])
        if (isPage) {
          setPageResults(payload.resultCards ?? [])
          setFilters(payload.suggestedFilters ?? [])
        }
      } finally {
        setLoadingSuggestions(false)
      }
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, isPage])

  useEffect(() => {
    setPageResults(initialResults)
  }, [initialResults])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function runSearch(value = query, entityTypes?: SearchResult["entity_type"][]) {
    const q = value.trim()
    if (q.length < 2) return
    setLoadingSearch(true)
    startNavigation(() => {
      if (isPage) router.replace(`/buscar?q=${encodeURIComponent(q)}`)
      else router.push(`/buscar?q=${encodeURIComponent(q)}`)
    })
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, entityTypes, limit: 24 }),
      })
      if (!response.ok) return
      const payload = (await response.json()) as SearchPayload
      setPageResults(payload.resultCards ?? [])
      setFilters(payload.suggestedFilters ?? [])
      setOpen(false)
    } finally {
      setLoadingSearch(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    void runSearch()
  }

  const groups = useMemo(() => groupedResults(suggestions), [suggestions])
  const pageGroups = useMemo(() => groupedResults(pageResults.length ? pageResults : suggestions), [pageResults, suggestions])
  const meaningful = query.trim().length >= 2

  return (
    <div ref={ref} className={cn("relative w-full", isPage ? "space-y-5" : "mx-auto max-w-xl")}>
      <form onSubmit={submit} role="search">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              placeholder="Pregunta por personas, votaciones, contratos, subvenciones, presupuestos o indicadores"
              aria-label="Buscar o preguntar"
              aria-busy={loadingSuggestions || loadingSearch || isNavigating}
              autoComplete="off"
              className={cn(
                "w-full rounded border border-border bg-card pl-10 pr-3 outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
                isPage ? "h-11 text-sm" : "h-12 text-base sm:text-lg"
              )}
            />
          </div>
          <button
            type="submit"
            disabled={!meaningful || loadingSearch}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded border border-border bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            <span className="hidden sm:inline">Buscar</span>
          </button>
        </div>
      </form>

      {!isPage && open && meaningful && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded border border-border bg-card shadow-lg">
          <button
            type="button"
            onClick={() => void runSearch()}
            className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-muted"
          >
            <span className="truncate">Ver resultados para: {query.trim()}</span>
            {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </button>
          {groups.length > 0 ? (
            <div className="max-h-[28rem] overflow-y-auto p-2">
              {groups.slice(0, 5).map((group) => (
                <section key={group.type} className="py-1">
                  <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </h2>
                  <div className="space-y-1">
                    {group.results.slice(0, 3).map((result) => (
                      <ResultCard key={`${result.entity_type}-${result.id}`} result={result} compact />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              {loadingSuggestions ? "Buscando…" : "Sin sugerencias instantáneas."}
            </p>
          )}
        </div>
      )}

      {isPage && (
        <div className="space-y-6">
          {!meaningful ? (
            <p className="text-sm text-muted-foreground">Escribe al menos 2 caracteres para buscar.</p>
          ) : null}

          {meaningful && filters.length ? (
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={async () => {
                    setLoadingSearch(true)
                    try {
                      const response = await fetch("/api/search", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ query, entityTypes: filter.entityTypes, limit: 24 }),
                      })
                      if (response.ok) {
                        const payload = (await response.json()) as SearchPayload
                        setPageResults(payload.resultCards ?? [])
                        setFilters(payload.suggestedFilters ?? [])
                      }
                    } finally {
                      setLoadingSearch(false)
                    }
                  }}
                  className="rounded border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {filter.label}
                </button>
              ))}
            </div>
          ) : null}

          {meaningful && (
            <div className="space-y-5">
              {pageGroups.length > 0 ? (
                pageGroups.map((group) => (
                  <section key={group.type}>
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </h2>
                    <div className="space-y-2">
                      {group.results.map((result) => (
                        <ResultCard key={`${result.entity_type}-${result.id}`} result={result} />
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin resultados.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
