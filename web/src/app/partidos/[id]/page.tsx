import { notFound } from "next/navigation"
import Link from "next/link"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { SectionTabs } from "@/components/domain/SectionTabs"
import { getPartyPageData, getPartyVotingSessions } from "@/lib/data"
import type { PoliticianWithMemberships } from "@/types"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { party } = await getPartyPageData(id)
  return { title: party?.acronym ?? "Partido" }
}

export default async function PartyPage({ params }: PageProps) {
  const { id } = await params
  const [{ party, memberships, stats }, votingSessions] = await Promise.all([
    getPartyPageData(id),
    getPartyVotingSessions(id),
  ])
  if (!party) notFound()

  const statItems = [
    { label: "Diputados activos", value: memberships.length, hint: "Escaños con membresía activa en la XV Legislatura." },
    ...(stats
      ? [
          { label: "Asistencia media", value: `${stats.attendance_pct ?? "—"}%`, hint: "Promedio del grupo en votaciones nominales." },
          { label: "Votos a favor", value: `${stats.pct_yes ?? "—"}%`, hint: "Porcentaje de votos 'Sí' sobre el total registrado." },
          { label: "Votos en contra", value: `${stats.pct_no ?? "—"}%`, hint: "Porcentaje de votos 'No' sobre el total registrado." },
          { label: "Abstenciones", value: `${stats.pct_abstain ?? "—"}%`, hint: "Porcentaje de abstenciones sobre el total registrado." },
        ]
      : []),
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title={party.acronym}
        description={party.name}
        eyebrow={
          <div
            className="h-3 w-3 rounded-full border border-border/60"
            style={{ backgroundColor: party.color }}
          />
        }
      />

      <StatGrid items={statItems} />

      <SectionTabs
        tabs={[
          { value: "diputados", label: "Diputados", count: memberships.length },
          { value: "votaciones", label: "Votaciones", count: votingSessions.length },
        ]}
        defaultTab="diputados"
        panels={{
          diputados: (
            <div className="ui-grid-cards">
              {memberships.map((m) => {
                const pol = m.politician as unknown as Record<string, unknown>
                return (
                  <PoliticianCard
                    key={pol.id as string}
                    politician={{ ...pol, politician_memberships: [m] } as unknown as PoliticianWithMemberships}
                  />
                )
              })}
            </div>
          ),
          votaciones: (
            <div className="space-y-2">
              {votingSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin votaciones registradas.</p>
              ) : (
                votingSessions.map((s) => {
                  const total = Object.values(s.partyVotes).reduce((a, b) => a + b, 0)
                  const pctYes = total > 0 ? Math.round(((s.partyVotes["Sí"] ?? 0) / total) * 100) : 0
                  const pctNo = total > 0 ? Math.round(((s.partyVotes["No"] ?? 0) / total) * 100) : 0
                  const pctAbs = total > 0 ? Math.round(((s.partyVotes["Abstención"] ?? 0) / total) * 100) : 0
                  const dateStr = new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })

                  return (
                    <Link
                      key={s.id}
                      href={`/votaciones/${s.id}`}
                      className="flex min-w-0 items-start justify-between gap-4 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm transition-colors hover:border-border hover:bg-card"
                    >
                      <div className="min-w-0">
                        <p className="min-w-0 truncate font-medium">{s.title}</p>
                        {total > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {s.partyVotes["Sí"] ?? 0} sí · {s.partyVotes["No"] ?? 0} no · {s.partyVotes["Abstención"] ?? 0} abs
                            {" · "}
                            <span className="text-green-600 dark:text-green-400">{pctYes}% favor</span>
                            {pctNo > 0 && <span className="text-red-600 dark:text-red-400"> · {pctNo}% contra</span>}
                            {pctAbs > 0 && <span> · {pctAbs}% abs</span>}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs text-muted-foreground">{dateStr}</span>
                        {s.divergence_count > 0 && (
                          <p className="mt-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
                            {s.divergence_count} div.
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          ),
        }}
      />
    </div>
  )
}
