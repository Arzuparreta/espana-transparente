"use client"

import { useMemo, useState } from "react"
import { SectionTabs } from "@/components/domain/SectionTabs"
import { RecordTable } from "@/components/domain/RecordTable"
import { EntityLink } from "@/components/domain/EntityLink"
import { EmptyState } from "@/components/domain/EmptyState"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"

export type PartyMember = { id: string; name: string; constituency: string; group: string }
export type PartySession = { id: string; title: string; date: string; divergence_count: number; partyVotes: Record<string, number> }
export type PartyCase = { id: string; title: string; status: string; court: string | null; territory: string | null; date: string | null }
export function PartyPanels({ members, sessions, cases }: { members: PartyMember[]; sessions: PartySession[]; cases: PartyCase[] }) {
  const [query, setQuery] = useState("")
  const [visible, setVisible] = useState(30)
  const filtered = useMemo(() => {
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const q = normalize(query.trim())
    return q ? members.filter((m) => normalize(`${m.name} ${m.constituency}`).includes(q)) : members
  }, [members, query])
  const tabs = [{ value: "diputados", label: "Diputados", count: members.length }, { value: "votaciones", label: "Votaciones", count: sessions.length },
    ...(cases.length ? [{ value: "casos", label: "Casos judiciales", count: cases.length }] : [])]
  return <SectionTabs tabs={tabs} defaultTab="diputados">{(active) => {
    if (active === "diputados") return <div id="diputados" className="scroll-mt-24 space-y-3">
      {members.length === 0 ? <EmptyState title="Sin diputados activos" description="No hay escaños con membresía activa en la muestra actual." /> : <>
        <input type="search" aria-label="Filtrar diputados del partido" placeholder="Nombre o circunscripción…" value={query}
          onChange={(event) => { setQuery(event.target.value); setVisible(30) }} className="w-full rounded border border-border bg-background px-3 py-2 text-sm" />
        <p className="text-xs text-muted-foreground">Mostrando {Math.min(visible, filtered.length)} de {filtered.length} diputados</p>
        <RecordTable caption="Diputados del grupo parlamentario" rows={filtered.slice(0, visible)} keyFor={(m) => m.id} columns={[
          { header: "Diputado", primary: true, cell: (m) => <EntityLink kind="politician" id={m.id} className="underline-offset-2 hover:underline">{m.name}</EntityLink> },
          { header: "Circunscripción", cell: (m) => m.constituency || "—" },
          { header: "Grupo", hideOnMobile: true, cell: (m) => m.group || "—" },
        ]} />
        {filtered.length > visible && <button type="button" className="min-h-11 rounded border border-border px-4 text-sm" onClick={() => setVisible((n) => n + 30)}>Mostrar más diputados</button>}
      </>}
    </div>
    if (active === "votaciones") return <div id="votaciones" className="scroll-mt-24">
      {sessions.length === 0 ? <EmptyState title="Sin votaciones" description="No hay sesiones registradas para este grupo en la muestra actual." /> :
        <div className="divide-y divide-border/50">{sessions.map((s) => {
          const total = Object.values(s.partyVotes).reduce((a, b) => a + b, 0)
          return <EntityLink key={s.id} kind="voting-session" id={s.id} className="-mx-2 flex min-w-0 items-start justify-between gap-4 px-2 py-3 text-sm transition-colors hover:bg-muted/40">
            <div className="min-w-0"><p className="truncate font-medium">{s.title}</p>
              {total > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{s.partyVotes["Sí"] ?? 0} sí · {s.partyVotes["No"] ?? 0} no · {s.partyVotes["Abstención"] ?? 0} abs · {Math.round(((s.partyVotes["Sí"] ?? 0) / total) * 100)}% favor
                {(s.partyVotes["No"] ?? 0) > 0 && <> · {Math.round(((s.partyVotes["No"] ?? 0) / total) * 100)}% contra</>}
                {(s.partyVotes["Abstención"] ?? 0) > 0 && <> · {Math.round(((s.partyVotes["Abstención"] ?? 0) / total) * 100)}% abs</>}
              </p>}
            </div>
            <div className="shrink-0 text-right"><span className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" })}</span>
              {s.divergence_count > 0 && <p className="mt-0.5 rounded border border-accent/35 px-2 text-xs text-accent">{s.divergence_count} div.</p>}
            </div>
          </EntityLink>
        })}</div>}
    </div>
    return <div id="casos" className="scroll-mt-24 space-y-3">
      <p className="text-xs text-muted-foreground">Procedimientos en los que el partido está identificado como actor por fuentes oficiales.</p>
      {cases.map((c) => <div key={c.id} className="border-b border-border/50 py-3 text-sm">
        <ResponsiveLink href={`/corrupcion/${c.id}`} className="font-medium hover:underline">{c.title}</ResponsiveLink>
        <p className="text-xs text-muted-foreground">{c.status}{c.court ? ` · ${c.court}` : ""}{c.territory ? ` · ${c.territory}` : ""}</p>
        {c.date && <p className="text-xs text-muted-foreground">{c.date}</p>}
      </div>)}
    </div>
  }}</SectionTabs>
}
