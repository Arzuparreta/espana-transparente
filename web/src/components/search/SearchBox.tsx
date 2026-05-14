"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { PartyBadge } from "@/components/domain/PartyBadge"
import type { PoliticianWithMemberships } from "@/types"

interface PartyResult {
  id: string
  acronym: string
  name: string
  color: string | null
}

interface VotingSessionResult {
  id: string
  title: string
  session_number: number
  date: string
}

export function SearchBox() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PoliticianWithMemberships[]>([])
  const [partyResults, setPartyResults] = useState<PartyResult[]>([])
  const [sessionResults, setSessionResults] = useState<VotingSessionResult[]>([])
  const [open, setOpen] = useState(false)
  const [isNavigating, startNavigation] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      setPartyResults([])
      setSessionResults([])
      return
    }
    const timer = setTimeout(async () => {
      const [politiciansResponse, partiesResponse, sessionsResponse] = await Promise.all([
        supabase
          .from("politicians")
          .select("id, full_name, politician_memberships!inner(*, party:parties(*))")
          .eq("politician_memberships.is_active", true)
          .ilike("full_name", `%${query}%`)
          .limit(6),
        supabase
          .from("parties")
          .select("id, acronym, name, color")
          .or(`name.ilike.%${query}%,acronym.ilike.%${query}%`)
          .limit(4),
        supabase
          .from("voting_sessions")
          .select("id, title, session_number, date")
          .ilike("title", `%${query}%`)
          .order("date", { ascending: false })
          .limit(4),
      ])

      setResults((politiciansResponse.data as PoliticianWithMemberships[]) || [])
      setPartyResults((partiesResponse.data as PartyResult[]) || [])
      setSessionResults((sessionsResponse.data as VotingSessionResult[]) || [])
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const hasResults = results.length > 0 || partyResults.length > 0 || sessionResults.length > 0
  const navigateTo = (href: string) => {
    setOpen(false)
    setQuery("")
    startNavigation(() => router.push(href))
  }

  return (
    <div ref={ref} className="relative max-w-xl mx-auto w-full">
      <Input
        type="search"
        placeholder="Busca personas, partidos o votaciones..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="h-12 rounded-2xl border-border/70 bg-card px-4 text-base shadow-sm sm:text-lg"
        aria-busy={isNavigating}
      />
      {open && query.length >= 2 && hasResults && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl">
          {results.length > 0 && (
            <div className="border-b last:border-b-0">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Personas
              </div>
              {results.map((r) => {
                const membership = r.politician_memberships?.[0]
                const party = membership?.party
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      navigateTo(`/diputados/${r.id}`)
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.full_name}</span>
                      {membership?.constituency ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {membership.constituency}
                        </span>
                      ) : null}
                    </span>
                    {party && (
                      <PartyBadge acronym={party.acronym} color={party.color} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {partyResults.length > 0 && (
            <div className="border-b last:border-b-0">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Partidos
              </div>
              {partyResults.map((party) => (
                <button
                  key={party.id}
                  onClick={() => {
                    navigateTo(`/partidos/${party.id}`)
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{party.name}</span>
                  <PartyBadge acronym={party.acronym} color={party.color} />
                </button>
              ))}
            </div>
          )}

          {sessionResults.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Votaciones
              </div>
              {sessionResults.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    navigateTo(`/votaciones/${session.id}`)
                  }}
                  className="w-full px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <div className="font-medium line-clamp-1">{session.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Sesión {session.session_number} ·{" "}
                    {new Date(session.date).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
