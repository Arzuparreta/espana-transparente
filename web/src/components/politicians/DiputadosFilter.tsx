"use client"

import { useState, useMemo } from "react"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import type { PoliticianWithMemberships } from "@/types"

interface Props {
  politicians: PoliticianWithMemberships[]
}

export function DiputadosFilter({ politicians }: Props) {
  const [query, setQuery] = useState("")
  const [activeParty, setActiveParty] = useState<string | null>(null)

  const parties = useMemo(() => {
    const counts = new Map<string, { color: string | null; n: number }>()
    for (const p of politicians) {
      const party = p.politician_memberships?.[0]?.party
      if (party?.acronym) {
        const prev = counts.get(party.acronym)
        counts.set(party.acronym, {
          color: party.color ?? null,
          n: (prev?.n ?? 0) + 1,
        })
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1].n - a[1].n)
      .map(([acronym, { color, n }]) => ({ acronym, color, n }))
  }, [politicians])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return politicians.filter((p) => {
      const matchesText =
        !q ||
        p.full_name.toLowerCase().includes(q) ||
        (p.politician_memberships?.[0]?.constituency ?? "").toLowerCase().includes(q)
      const matchesParty =
        !activeParty ||
        p.politician_memberships?.[0]?.party?.acronym === activeParty
      return matchesText && matchesParty
    })
  }, [politicians, query, activeParty])

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="flex flex-col gap-3 rounded-[2px] border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar por nombre o provincia…"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          aria-label="Filtrar diputados"
        />
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {filtered.length} / {politicians.length}
        </span>
      </div>

      {/* Party filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveParty(null)}
          className={`inline-flex min-h-9 items-center rounded px-3 font-mono text-xs transition-colors ${
            activeParty === null
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos
        </button>
        {parties.map(({ acronym, color, n }) => (
          <button
            key={acronym}
            type="button"
            onClick={() => setActiveParty(activeParty === acronym ? null : acronym)}
            style={
              activeParty === acronym && color
                ? { backgroundColor: color, color: "#0B0B0A", borderColor: color }
                : {}
            }
            className={`inline-flex min-h-9 items-center gap-1.5 rounded border px-3 font-mono text-xs transition-colors ${
              activeParty === acronym
                ? "border-transparent"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-[1px]"
              style={{ backgroundColor: color ?? undefined }}
            />
            {acronym}
            <span className={`tabular-nums ${activeParty === acronym ? "opacity-70" : "text-muted-foreground/70"}`}>
              {n}
            </span>
          </button>
        ))}
      </div>

      {/* Results grid */}
      {filtered.length > 0 ? (
        <div className="ui-grid-cards">
          {filtered.map((p) => (
            <PoliticianCard key={p.id} politician={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-[2px] border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          Ningún diputado coincide con los filtros aplicados.
        </div>
      )}
    </div>
  )
}
