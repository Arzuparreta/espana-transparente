import { notFound } from "next/navigation"
import Link from "next/link"
import { PoliticianCard } from "@/components/politicians/PoliticianCard"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { getPartyPageData } from "@/lib/data"
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

function VoteBar({ yes, no, abstain, absent }: { yes: number; no: number; abstain: number; absent: number }) {
  return (
    <div className="space-y-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-green-600/75" style={{ width: `${yes}%` }} title={`Sí: ${yes}%`} />
        <div className="h-full bg-red-600/75"   style={{ width: `${no}%` }}  title={`No: ${no}%`} />
        <div className="h-full bg-amber-500/75" style={{ width: `${abstain}%` }} title={`Abstención: ${abstain}%`} />
        <div className="h-full bg-muted-foreground/20" style={{ width: `${absent}%` }} title={`No vota: ${absent}%`} />
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span><span className="font-medium text-green-700 dark:text-green-400">{yes}%</span> Sí</span>
        <span><span className="font-medium text-red-700 dark:text-red-400">{no}%</span> No</span>
        <span><span className="font-medium text-amber-600 dark:text-amber-400">{abstain}%</span> Abstención</span>
        <span><span className="font-medium">{absent}%</span> Ausente</span>
      </div>
    </div>
  )
}

export default async function PartyPage({ params }: PageProps) {
  const { id } = await params
  const { party, memberships, stats } = await getPartyPageData(id)
  if (!party) notFound()

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

      {stats && (
        <>
          <StatGrid
            items={[
              { label: "Diputados activos", value: stats.deputy_count.toString() },
              { label: "Asistencia media", value: `${stats.attendance_pct}%` },
              { label: "Total votos emitidos", value: Number(stats.total_votes).toLocaleString("es-ES") },
            ]}
          />

          <section className="rounded-xl border border-border/70 bg-card/80 px-5 py-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Distribución de voto
            </h2>
            <VoteBar
              yes={Number(stats.pct_yes)}
              no={Number(stats.pct_no)}
              abstain={Number(stats.pct_abstain)}
              absent={Number(stats.pct_absent)}
            />
          </section>

          <div className="text-sm">
            <Link
              href={`/divergencias`}
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver ranking de divergencias internas →
            </Link>
          </div>
        </>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          {memberships.length} diputado{memberships.length !== 1 ? "s" : ""} activo{memberships.length !== 1 ? "s" : ""}
        </h2>
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
      </section>
    </div>
  )
}
