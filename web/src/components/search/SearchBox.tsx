"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import type { PoliticianWithMemberships } from "@/types"

export function SearchBox() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PoliticianWithMemberships[]>([])
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("politicians")
        .select("id, full_name, politician_memberships(*, party:parties(*))")
        .ilike("full_name", `%${query}%`)
        .limit(8)
      setResults((data as PoliticianWithMemberships[]) || [])
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

  return (
    <div ref={ref} className="relative max-w-xl mx-auto w-full">
      <Input
        type="search"
        placeholder="Busca un diputado o diputada..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className="h-12 text-lg"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-card border rounded-lg shadow-lg z-50 overflow-hidden">
          {results.map((r) => {
            const membership = r.politician_memberships?.[0]
            const party = membership?.party
            return (
              <button
                key={r.id}
                onClick={() => {
                  router.push(`/diputados/${r.id}`)
                  setOpen(false)
                  setQuery("")
                }}
                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-center justify-between"
              >
                <span className="font-medium">{r.full_name}</span>
                {party && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: party.color + "20",
                      color: party.color,
                    }}
                  >
                    {party.acronym}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
