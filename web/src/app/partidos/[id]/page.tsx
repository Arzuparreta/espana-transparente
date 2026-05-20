import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EmptyState } from "@/components/domain/EmptyState"
import { EntityLink } from "@/components/domain/EntityLink"
import { PartyLogo } from "@/components/domain/PartyLogo"
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

  const partyLabel = party.name ?? party.acronym ?? "Partido"

  return (
    <div className="space-y-8">
      <ContextTrail
        section={{ href: "/partidos", label: "Partidos" }}
        current={party.acronym ?? partyLabel}
        meta={party.name && party.acronym !== party.name ? party.name : undefined}
        fallbackHref="/partidos"
        fallbackLabel="Volver a Partidos"
        related={[
          memberships.length > 0
            ? { href: "#diputados", label: "Diputados", meta: String(memberships.length) }
            : null,
          votingSessions.length > 0
            ? { href: "#votaciones", label: "Votaciones", meta: String(votingSessions.length) }
            : null,
        ]}
      />
      <PageHeader
        title={party.acronym}
        description={party.name}
        eyebrow={
          <PartyLogo
            src={party.logo_url}
            color={party.color}
            acronym={party.acronym}
            size="lg"
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
            <div id="diputados" className="ui-grid-cards scroll-mt-24">
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
            <div id="votaciones" className="space-y-2 scroll-mt-24">
              {votingSessions.length === 0 ? (
                <EmptyState
                  title="Sin votaciones"
                  description="No hay sesiones registradas para este grupo en la muestra actual."
                  action={
                    <a
                      href="/estado-datos"
                      className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Ver estado de los datos →
                    </a>
                  }
                />
              ) : (
                votingSessions.map((s) => {
                  const total = Object.values(s.partyVotes).reduce((a, b) => a + b, 0)
                  const pctYes = total > 0 ? Math.round(((s.partyVotes["Sí"] ?? 0) / total) * 100) : 0
                  const pctNo = total > 0 ? Math.round(((s.partyVotes["No"] ?? 0) / total) * 100) : 0
                  const pctAbs = total > 0 ? Math.round(((s.partyVotes["Abstención"] ?? 0) / total) * 100) : 0
                  const dateStr = new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })

                  return (
                    <EntityLink
                      key={s.id}
                      kind="voting-session"
                      id={s.id}
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
                          <p className="mt-0.5 rounded border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-accent">
                            {s.divergence_count} div.
                          </p>
                        )}
                      </div>
                    </EntityLink>
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
