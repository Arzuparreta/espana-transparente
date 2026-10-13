import { SenatorsDirectory } from "@/components/politicians/SenatorsDirectory"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { InfoPanel } from "@/components/domain/InfoPanel"
import {
  getSenators,
  getSenatorStats,
  getSenateSessionCount,
  getSenateNominalVoteStats,
  getEtlLastFinished,
} from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Senado",
  description: "Senadoras y senadores en activo: partido, fuente oficial y enlace a su ficha en el Senado.",
}

export default async function SenadoPage() {
  const [senators, stats, sessionCount, voteStats, lastChecked] = await Promise.all([
    getSenators(),
    getSenatorStats(),
    getSenateSessionCount(),
    getSenateNominalVoteStats(),
    getEtlLastFinished(["senado.senadores", "senado.votaciones"]),
  ])
  const hasNominalVotes = voteStats.voteRows > 0

  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <PageHeader
        title="Senado de España"
        description="La cámara alta del parlamento: revisa y puede vetar las leyes que vienen del Congreso. Sus miembros son electos por provincia y designados por las comunidades autónomas."
      />

      <SourceFootnote
        sourceLabel="Senado de España"
        sourceHref="https://www.senado.es"
        lastChecked={lastChecked}
        coverageLabel={`${stats.total} senadores activos${sessionCount > 0 ? ` · ${sessionCount} sesiones indexadas` : ""}${
          hasNominalVotes
            ? ` · ${voteStats.voteRows.toLocaleString("es-ES")} votos nominales`
            : " · votos nominales pendientes de ingestión medida"
        }`}
      />

      <StatGrid
        items={[
          { label: "Total senadores", value: stats.total },
          { label: "Electos", value: stats.byType.elected },
          { label: "Designados CCAA", value: stats.byType.designated },
          { label: "Grupos parlamentarios", value: stats.byGroup.length },
        ]}
      />

      <p className="text-xs leading-5 text-muted-foreground">
        {hasNominalVotes
          ? `Votaciones nominales incorporadas desde XML oficial del Senado en ${voteStats.sessionsWithVotes.toLocaleString("es-ES")} votaciones.`
          : "Sesiones del Senado indexadas. Las votaciones nominales se mostrarán cuando el ciclo de ingestión incorpore votos por senador."}
      </p>

      {stats.byGroup.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Por grupo parlamentario
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.byGroup.map(({ name, party, count }) => (
              <div
                key={name}
                className="flex items-center gap-1.5 rounded-[2px] border px-3 py-1 text-sm"
                style={{ borderColor: `${getPartyColor(party?.color ?? null)}44` }}
              >
                <span
                  className="h-2 w-2 shrink-0"
                  style={{ backgroundColor: getPartyColor(party?.color ?? null) }}
                />
                <span className="font-medium">{party?.acronym ?? name}</span>
                <span className="text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {senators.length === 0 ? (
        <InfoPanel title="Datos del Senado no disponibles todavía">
          Los datos de senadores se están ingiriendo automáticamente cada semana. Si esta página aparece vacía, el primer ciclo de ingestión aún no se ha completado.
        </InfoPanel>
      ) : (
        <SenatorsDirectory senators={senators.map((senator) => ({
          ...senator,
          politician_memberships: senator.politician_memberships.map((membership) => ({
            ...membership, raw_data: { tipo_procedencia: membership.raw_data?.tipo_procedencia }
          }))
        }))} />
      )}
    </div>
  )
}
