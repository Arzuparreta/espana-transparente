import { PartyPanels } from "@/components/politicians/PartyPanels"
import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityTrail, EntityTrailSkeleton } from "@/components/domain/EntityTrail"
import { PartyLogo } from "@/components/domain/PartyLogo"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { getPartyPageData, getPartyVotingSessions, getPartyJudicialCases, JUDICIAL_STATUS_LABEL } from "@/lib/data"
import type { JudicialStatus } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { party } = await getPartyPageData(id)
  return { title: party?.acronym ?? "Partido" }
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
}

export default async function PartyPage({ params }: PageProps) {
  const { id } = await params
  const [{ party, memberships, stats }, votingSessions, judicialCases] = await Promise.all([
    getPartyPageData(id),
    getPartyVotingSessions(id),
    getPartyJudicialCases(id),
  ])
  if (!party) notFound()

  const statItems = [
    { label: "Diputados activos", value: memberships.length, hint: "Escaños con membresía activa en la XV Legislatura." },
    ...(stats
      ? [
          { label: "Sesiones con voto (media)", value: `${stats.attendance_pct ?? "—"}%`, hint: "Promedio de sus diputados en sesiones con votación nominal; no mide presencia física." },
          { label: "Votos a favor", value: `${stats.pct_yes ?? "—"}%`, hint: "Porcentaje de votos 'Sí' sobre el total registrado." },
          { label: "Votos en contra", value: `${stats.pct_no ?? "—"}%`, hint: "Porcentaje de votos 'No' sobre el total registrado." },
          { label: "Abstenciones", value: `${stats.pct_abstain ?? "—"}%`, hint: "Porcentaje de abstenciones sobre el total registrado." },
        ]
      : []),
    ...(judicialCases.length > 0
      ? [
          {
            label: "Casos judiciales",
            value: judicialCases.length,
            hint: "Procedimientos judiciales en los que el partido está identificado como actor, según fuentes oficiales.",
          },
        ]
      : []),
  ]

  const partyLabel = party.name ?? party.acronym ?? "Partido"

  const seenCaseIds = new Set<string>()
  const uniqueCases = judicialCases.filter((c) => {
    if (seenCaseIds.has(c.case_id)) return false
    seenCaseIds.add(c.case_id)
    return true
  })

  return (
    <div className="ui-page">
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
          uniqueCases.length > 0
            ? { href: "#casos", label: "Casos judiciales", meta: String(uniqueCases.length) }
            : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={<PartyLogo src={party.logo_url} color={party.color} acronym={party.acronym} size="lg" />}
            title={party.acronym}
            description={party.name}
          />
        }
        aside={
          <Suspense fallback={<EntityTrailSkeleton />}>
            <EntityTrail entityType="party" entityId={id} />
          </Suspense>
        }
      >
        <StatGrid variant="flat" items={statItems} />

        <PartyPanels
          members={memberships.map((m) => {
            const person = m.politician as unknown as { id: string; full_name: string }
            return { id: person.id, name: person.full_name, constituency: m.constituency ?? "", group: m.group_parliamentary ?? "" }
          })}
          sessions={votingSessions}
          cases={uniqueCases.map((c) => ({ id: c.case_id, title: c.title,
            status: c.procedural_status ? JUDICIAL_STATUS_LABEL[c.procedural_status as JudicialStatus] ?? c.procedural_status : "Estado no especificado",
            court: c.court_body, territory: c.territory, date: formatDate(c.source_published_at) }))}
        />
      </RecordLayout>
    </div>
  )
}
