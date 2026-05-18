import { notFound } from "next/navigation"
import { EmptyState } from "@/components/domain/EmptyState"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { getVoteColor } from "@/lib/domain-style"
import { getInitiativeDetail } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { initiative } = await getInitiativeDetail(id)
  return { title: initiative?.title ?? initiative?.number ?? "Iniciativa" }
}

const TYPE_LABELS: Record<string, string> = {
  proyecto_ley: "Proyecto de Ley",
  proposicion_ley: "Proposición de Ley",
  proposicion_no_de_ley: "Proposición no de Ley",
  mocion: "Moción",
  interpelacion: "Interpelación",
  pregunta: "Pregunta",
}

const STATUS_LABELS: Record<string, string> = {
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  retirada: "Retirada",
  en_tramitacion: "En tramitación",
  caducada: "Caducada",
}

function VoteBar({ yes, no, abs, absent }: { yes: number; no: number; abs: number; absent: number }) {
  const total = yes + no + abs + absent
  if (total === 0) return null
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
      <div style={{ width: `${(yes / total) * 100}%`, backgroundColor: getVoteColor("Sí") }} />
      <div style={{ width: `${(no / total) * 100}%`, backgroundColor: getVoteColor("No") }} />
      <div style={{ width: `${(abs / total) * 100}%`, backgroundColor: getVoteColor("Abstención") }} />
    </div>
  )
}

export default async function IniciativaPage({ params }: PageProps) {
  const { id } = await params
  const { initiative, sessions } = await getInitiativeDetail(id)
  if (!initiative) notFound()

  const typeLabel = TYPE_LABELS[initiative.type] ?? initiative.type
  const statusLabel = STATUS_LABELS[initiative.status ?? ""] ?? initiative.status

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={initiative.title ?? initiative.number}
        description={[typeLabel, statusLabel ? `Estado: ${statusLabel}` : null].filter(Boolean).join(" · ")}
        eyebrow={
          initiative.number ? (
            <span className="font-mono text-xs text-muted-foreground">Exp. {initiative.number}</span>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-border/70 bg-card/80 px-6 py-4">
        <dl className="space-y-0">
          {initiative.type && (
            <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-border/50 py-3 text-sm first:border-0">
              <dt className="text-muted-foreground">Tipo</dt>
              <dd className="font-medium">{typeLabel}</dd>
            </div>
          )}
          {initiative.proposer_group && (
            <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-border/50 py-3 text-sm">
              <dt className="text-muted-foreground">Grupo proponente</dt>
              <dd className="font-medium">{initiative.proposer_group}</dd>
            </div>
          )}
          {statusLabel && (
            <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-border/50 py-3 text-sm">
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="font-medium">{statusLabel}</dd>
            </div>
          )}
          {initiative.source_url && (
            <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-border/50 py-3 text-sm">
              <dt className="text-muted-foreground">Fuente</dt>
              <dd>
                <a
                  href={initiative.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  Ver en Congreso.es →
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {sessions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Votaciones vinculadas
            <span className="ml-2 text-sm font-normal text-muted-foreground">({sessions.length})</span>
          </h2>
          {sessions.map((s) => {
            const yes = (s.votes_yes as number) ?? 0
            const no = (s.votes_no as number) ?? 0
            const abs = (s.votes_abstain as number) ?? 0
            const absent = (s.votes_no_vote as number) ?? 0
            const dateStr = s.date
              ? new Date(s.date as string).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
              : ""

            return (
              <EntityLink
                key={s.id as string}
                kind="voting-session"
                id={s.id as string}
                className="block rounded-xl border border-border/60 bg-card/80 px-4 py-4 transition-colors hover:border-border hover:bg-card"
              >
                <p className="text-sm font-medium leading-snug">{s.title as string}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dateStr}</p>
                <div className="mt-2 space-y-1">
                  <VoteBar yes={yes} no={no} abs={abs} absent={absent} />
                  <div className="flex gap-4 text-[11px] text-muted-foreground">
                    <span className="text-green-600 dark:text-green-400">{yes} sí</span>
                    <span className="text-red-600 dark:text-red-400">{no} no</span>
                    {abs > 0 && <span className="text-amber-600 dark:text-amber-400">{abs} abs</span>}
                    {(s.divergence_count as number) > 0 && (
                      <span className="ml-auto rounded border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
                        {s.divergence_count as number} divergencia{(s.divergence_count as number) !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </EntityLink>
            )
          })}
        </section>
      )}

      {sessions.length === 0 && (
        <EmptyState
          title="Sin votaciones vinculadas"
          description="No se han registrado votaciones nominales vinculadas a esta iniciativa."
        />
      )}
    </div>
  )
}
