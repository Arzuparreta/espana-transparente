"use client"

import { useMemo, useState } from "react"
import { EntityLink } from "./EntityLink"
import { PartyBadge } from "./PartyBadge"
import { VoteBadge } from "./VoteBadge"

export type IndividualVote = {
  name: string; vote: string; politicianId: string | null
  party: string; partyId: string | null; color: string
}
export function IndividualVotes({ rows, chamber }: { rows: IndividualVote[]; chamber: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [visible, setVisible] = useState(50)
  const filtered = useMemo(() => {
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const q = normalize(query.trim())
    return q ? rows.filter((row) => normalize(`${row.name} ${row.party}`).includes(q)) : rows
  }, [rows, query])
  return (
    <details className="text-sm" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Ver voto individual de cada {chamber === "senate" ? "senador" : "diputado"}
      </summary>
      {open && <div className="mt-3 space-y-3">
        <input type="search" aria-label="Filtrar votos individuales" placeholder="Nombre o partido…"
          value={query} onChange={(event) => { setQuery(event.target.value); setVisible(50) }}
          className="w-full rounded border border-border bg-background px-3 py-2" />
        <p className="text-xs text-muted-foreground">{filtered.length} votos individuales · mostrando {Math.min(visible, filtered.length)}</p>
        <div className="max-h-96 overflow-y-auto border-t border-border pt-2">
          {filtered.slice(0, visible).map((row, index) => <div key={`${row.politicianId}-${index}`}
            className="flex items-center justify-between gap-3 border-b border-muted/30 py-1 last:border-0">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <EntityLink kind={chamber === "senate" ? "senator" : "politician"} id={row.politicianId}
                className="min-w-0 truncate text-xs underline-offset-2 hover:underline">{row.name}</EntityLink>
              <PartyBadge acronym={row.party} color={row.color} partyId={row.partyId} className="shrink-0 text-xs" />
            </div>
            <VoteBadge vote={row.vote} className="shrink-0 text-xs" />
          </div>)}
        </div>
        {filtered.length > visible && <button type="button" className="min-h-11 rounded border border-border px-4"
          onClick={() => setVisible((count) => count + 50)}>Mostrar más votos</button>}
      </div>}
    </details>
  )
}
