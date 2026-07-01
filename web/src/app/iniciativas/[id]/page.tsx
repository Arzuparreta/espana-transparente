import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EmptyState } from "@/components/domain/EmptyState"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import { FieldList, type FieldItem } from "@/components/domain/FieldList"
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

const ORIGIN_LABELS: Record<string, string> = {
  gobierno: "Proyecto del Gobierno",
  parlamento: "Proposición parlamentaria",
  iniciativa_popular: "Iniciativa legislativa popular",
  transposicion_ue: "Transposición de directiva UE",
  comision_europea: "Iniciativa de la Comisión Europea",
  senado: "Proyecto del Senado",
}

function originLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return ORIGIN_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)
}

function VoteBar({ yes, no, abs, absent }: { yes: number; no: number; abs: number; absent: number }) {
  const total = yes + no + abs + absent
  if (total === 0) return null
  return (
    <div className="flex h-2 overflow-hidden rounded-[2px] bg-muted">
      <div style={{ width: `${(yes / total) * 100}%`, backgroundColor: getVoteColor("Sí") }} />
      <div style={{ width: `${(no / total) * 100}%`, backgroundColor: getVoteColor("No") }} />
      <div style={{ width: `${(abs / total) * 100}%`, backgroundColor: getVoteColor("Abstención") }} />
    </div>
  )
}

function ProposerLink({
  proposer,
}: {
  proposer: {
    proposer_label: string
    politician_id: string | null
    politician_name: string | null
    party_id: string | null
    party_acronym: string | null
    organization_id: string | null
    organization_name: string | null
  }
}) {
  const label = proposer.politician_name ?? proposer.party_acronym ?? proposer.organization_name ?? proposer.proposer_label

  if (proposer.politician_id) {
    return (
      <EntityLink kind="politician" id={proposer.politician_id} className="underline-offset-2 hover:underline">
        {label}
      </EntityLink>
    )
  }
  if (proposer.party_id) {
    return (
      <EntityLink kind="party" id={proposer.party_id} className="underline-offset-2 hover:underline">
        {label}
      </EntityLink>
    )
  }
  if (proposer.organization_id) {
    return (
      <EntityLink kind="organization" id={proposer.organization_id} className="underline-offset-2 hover:underline">
        {label}
      </EntityLink>
    )
  }
  return <span>{label}</span>
}

export default async function IniciativaPage({ params }: PageProps) {
  const { id } = await params
  const { initiative, sessions, proposers } = await getInitiativeDetail(id)
  if (!initiative) notFound()

  const typeLabel = TYPE_LABELS[initiative.type] ?? initiative.type
  const statusLabel = STATUS_LABELS[initiative.status ?? ""] ?? initiative.status

  const items: FieldItem[] = []
  if (initiative.type) items.push({ label: "Tipo", value: typeLabel })
  if (initiative.proposer_group) items.push({ label: "Grupo proponente", value: initiative.proposer_group })
  if (proposers.length > 0) {
    items.push({
      label: "Proponentes",
      value: (
        <div className="flex flex-wrap gap-2">
          {proposers.map((proposer) => (
            <span key={proposer.id} className="rounded-[2px] border border-border bg-background px-2 py-1 text-xs font-medium">
              <ProposerLink proposer={proposer} />
            </span>
          ))}
        </div>
      ),
    })
  }
  if (statusLabel) items.push({ label: "Estado", value: statusLabel })
  if (initiative.origin_type) items.push({ label: "Origen", value: originLabel(initiative.origin_type) })
  if (initiative.eu_directive_ref) items.push({ label: "Directiva UE", value: initiative.eu_directive_ref, mono: true })
  if (initiative.budget_veto_used) items.push({ label: "Presupuestos", value: "Veto presupuestario utilizado" })
  if (initiative.source_url) {
    items.push({
      label: "Fuente",
      value: (
        <a href={initiative.source_url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
          Ver en Congreso.es →
        </a>
      ),
    })
  }

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/iniciativas", label: "Iniciativas" }}
        current={initiative.title ?? initiative.number}
        meta={initiative.number ? `Exp. ${initiative.number}` : undefined}
        fallbackHref="/iniciativas"
        fallbackLabel="Volver a Iniciativas"
        related={[
          sessions.length > 0
            ? { href: `/votaciones/${sessions[0].id}`, label: "Votación más reciente", meta: "Votaciones" }
            : null,
          initiative.source_url
            ? { href: initiative.source_url, label: "Ficha en Congreso.es", external: true }
            : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Iniciativa{initiative.number ? ` · Exp. ${initiative.number}` : ""}
              </span>
            }
            title={initiative.title ?? initiative.number}
            description={[typeLabel, statusLabel ? `Estado: ${statusLabel}` : null].filter(Boolean).join(" · ")}
          />
        }
      >
        <RecordSection title="Ficha">
          <FieldList items={items} />
        </RecordSection>

        <RecordSection title="Votaciones vinculadas" count={sessions.length}>
          {sessions.length === 0 ? (
            <EmptyState
              title="Sin votaciones vinculadas"
              description="No se han registrado votaciones nominales vinculadas a esta iniciativa."
            />
          ) : (
            <div className="divide-y divide-border/50">
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
                    className="-mx-2 block px-2 py-3 transition-colors hover:bg-muted/40"
                  >
                    <p className="text-sm font-medium leading-snug">{s.title as string}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dateStr}</p>
                    <div className="mt-2 space-y-1">
                      <VoteBar yes={yes} no={no} abs={abs} absent={absent} />
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="text-green-600 dark:text-green-400">{yes} sí</span>
                        <span className="text-red-600 dark:text-red-400">{no} no</span>
                        {abs > 0 && <span className="text-amber-600 dark:text-amber-400">{abs} abs</span>}
                        {(s.divergence_count as number) > 0 && (
                          <span className="ml-auto rounded border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-accent">
                            {s.divergence_count as number} divergencia{(s.divergence_count as number) !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </EntityLink>
                )
              })}
            </div>
          )}
        </RecordSection>
      </RecordLayout>
    </div>
  )
}
