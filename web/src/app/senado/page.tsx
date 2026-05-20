import Image from "next/image"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { EntityLink } from "@/components/domain/EntityLink"
import { getSenators, getSenatorStats, type Senator } from "@/lib/data"
import { getPartyColor } from "@/lib/domain-style"

export const revalidate = 3600 * 6

export const metadata = {
  title: "Senado",
  description: "Senadoras y senadores en activo: partido, fuente oficial y enlace a su ficha en el Senado.",
}

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
      className="flex min-h-[7rem] flex-col justify-between rounded-xl border bg-card/80 p-4 transition-colors hover:bg-card"
      style={{ borderColor: `${color}28` }}
    >
      <div className="flex min-w-0 items-start gap-3">
        {senator.photo_url ? (
          <Image
            src={senator.photo_url}
            alt={senator.full_name}
            width={40}
            height={52}
            className="h-13 w-10 shrink-0 rounded-md object-cover"
            unoptimized
          />
        ) : (
          <div
            className="flex h-13 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
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
          <EntityLink kind="politician" id={senator.id}>
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

export default async function SenadoPage() {
  const [senators, stats] = await Promise.all([getSenators(), getSenatorStats()])

  const byConstituency = new Map<string, Senator[]>()
  for (const s of senators) {
    const membership = s.politician_memberships[0]
    const key = membership?.constituency ?? "Sin asignar"
    const existing = byConstituency.get(key) ?? []
    existing.push(s)
    byConstituency.set(key, existing)
  }

  const constituencies = Array.from(byConstituency.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "es")
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Senado de España"
        description="La cámara alta del parlamento: 265 senadores que revisan y pueden vetar las leyes que vienen del Congreso. Electos por provincia y designados por las comunidades autónomas."
      />

      <StatGrid
        items={[
          { label: "Total senadores", value: stats.total },
          { label: "Electos", value: stats.byType.elected },
          { label: "Designados CCAA", value: stats.byType.designated },
          { label: "Grupos parlamentarios", value: stats.byGroup.length },
        ]}
      />

      {stats.byGroup.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Por grupo parlamentario
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.byGroup.map(({ name, party, count }) => (
              <div
                key={name}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
                style={{ borderColor: `${getPartyColor(party?.color ?? null)}44` }}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
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
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {senators.length} senadores · por circunscripción
          </h2>
          <div className="space-y-6">
            {constituencies.map(([constituency, members]) => (
              <div key={constituency}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {constituency} ({members.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {members.map((senator) => (
                    <SenatorCard key={senator.id} senator={senator} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
