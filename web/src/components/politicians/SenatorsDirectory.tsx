"use client"
import Image from "next/image"
import { useMemo, useState } from "react"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { EntityLink } from "@/components/domain/EntityLink"
import { getPartyColor } from "@/lib/domain-style"
import type { Senator } from "@/lib/data/senado"

function formatName(raw: string): string {
  return raw
    .split(",")
    .map((s) => s.trim())
    .reverse()
    .join(" ")
}

function SenatorCard({ senator }: { senator: Senator }) {
  const membership = senator.politician_memberships[0]
  const party = membership?.party ?? null
  const color = getPartyColor(party?.color ?? null)
  const constituency = membership?.constituency ?? null
  const rd = membership?.raw_data as { tipo_procedencia?: string } | null
  const tipo = rd?.tipo_procedencia ?? null

  return (
    <div
      data-slot="card"
      className="flex min-h-[7rem] flex-col justify-between rounded-[2px] border bg-card p-4 transition-colors hover:border-foreground/40"
      style={{ borderColor: `${color}28` }}
    >
      <div className="flex min-w-0 items-start gap-3">
        {senator.photo_url ? (
          <Image
            src={senator.photo_url}
            alt={senator.full_name}
            width={40}
            height={52}
            className="h-13 w-10 shrink-0 rounded-[2px] object-cover"
            unoptimized
          />
        ) : (
          <div
            className="flex h-13 w-10 shrink-0 items-center justify-center rounded-[2px] text-sm font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {senator.first_name[0]}
            {senator.last_name[0]}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground line-clamp-1">
            {constituency ?? "—"}
            {tipo ? ` · ${tipo.charAt(0) + tipo.slice(1).toLowerCase()}` : ""}
          </p>
          <EntityLink kind="senator" id={senator.id}>
            <p className="font-semibold leading-snug line-clamp-2 underline-offset-2 hover:underline">
              {formatName(senator.full_name)}
            </p>
          </EntityLink>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-2">
        {party && (
          <PartyBadge
            acronym={party.acronym ?? party.name}
            color={party.color ?? undefined}
            partyId={party.id ?? null}
          />
        )}
        {membership?.group_parliamentary && (
          <span className="truncate text-xs text-muted-foreground">
            {membership.group_parliamentary
              .replace(/GRUPO PARLAMENTARIO /i, "G.P. ")
              .slice(0, 50)}
          </span>
        )}
      </div>
    </div>
  )
}


export function SenatorsDirectory({ senators }: { senators: Senator[] }) {
  const [query, setQuery] = useState("")
  const [visible, setVisible] = useState(36)
  const grouped = useMemo(() => {
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const q = normalize(query.trim())
    const groups = new Map<string, Senator[]>()
    for (const s of senators) {
      const constituency = s.politician_memberships[0]?.constituency ?? "Sin asignar"
      if (q && !normalize(`${s.full_name} ${constituency}`).includes(q)) continue
      const members = groups.get(constituency) ?? []
      members.push(s); groups.set(constituency, members)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "es"))
  }, [senators, query])
  const filtered = grouped.flatMap(([, members]) => members)
  let remaining = visible
  return <section className="space-y-4">
    <h2 className="text-sm font-semibold uppercase tracking-wide">{senators.length} senadores · por circunscripción</h2>
    <input type="search" aria-label="Filtrar senadores" placeholder="Filtrar por nombre o circunscripción…"
      value={query} onChange={(event) => { setQuery(event.target.value); setVisible(36) }}
      className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
    <p className="font-mono text-xs text-muted-foreground">Mostrando {Math.min(visible, filtered.length)} de {filtered.length} senadores</p>
    <div className="space-y-6">{grouped.map(([constituency, members]) => {
      const shown = members.slice(0, Math.max(0, remaining)); remaining -= shown.length
      if (shown.length === 0) return null
      return <div key={constituency}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{constituency} ({shown.length} de {members.length})</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((senator) => <SenatorCard key={senator.id} senator={senator} />)}
        </div>
      </div>
    })}</div>
    {filtered.length === 0 && <p className="text-sm text-muted-foreground">Ningún senador coincide con los filtros.</p>}
    {filtered.length > visible && <button type="button" className="min-h-11 rounded border border-border px-4 text-sm"
      onClick={() => setVisible((count) => count + 36)}>Mostrar más senadores</button>}
  </section>
}
