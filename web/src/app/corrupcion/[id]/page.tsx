import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import { FieldList, type FieldItem } from "@/components/domain/FieldList"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getJudicialCaseDetail, JUDICIAL_STATUS_LABEL } from "@/lib/data"
import type { JudicialStatus } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

const LINK = "underline-offset-2 hover:underline"

function formatDate(value: string | null): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatAmount(value: number | null): string | null {
  if (value == null) return null
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { judicialCase } = await getJudicialCaseDetail(id)
  return { title: judicialCase?.title ?? "Proceso judicial" }
}

export default async function CorrupcionDetailPage({ params }: PageProps) {
  const { id } = await params
  const { judicialCase, actors, links } = await getJudicialCaseDetail(id)
  if (!judicialCase) notFound()

  const statusLabel = JUDICIAL_STATUS_LABEL[judicialCase.procedural_status as JudicialStatus]

  const items: FieldItem[] = [{ label: "Estado", value: statusLabel }]
  if (judicialCase.offence_category) items.push({ label: "Categoría", value: judicialCase.offence_category })
  if (judicialCase.court_body) items.push({ label: "Órgano", value: judicialCase.court_body })
  if (judicialCase.territory) items.push({ label: "Territorio", value: judicialCase.territory })
  if (judicialCase.procedure_type) items.push({ label: "Procedimiento", value: judicialCase.procedure_type })
  if (judicialCase.summary) items.push({ label: "Resumen", value: judicialCase.summary })
  items.push({ label: "Última verificación", value: formatDate(judicialCase.last_verified_at), mono: true })

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/corrupcion", label: "Procesos judiciales" }}
        current={judicialCase.title}
        meta={statusLabel}
        fallbackHref="/corrupcion"
        fallbackLabel="Volver a Procesos judiciales"
        related={[
          judicialCase.source_url
            ? { href: judicialCase.source_url, label: "Fuente oficial", external: true }
            : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Proceso judicial · {statusLabel}
              </span>
            }
            title={judicialCase.title}
            description="Detalle procesal publicado por fuentes oficiales. Los vínculos con entidades del portal requieren revisión previa."
          />
        }
        aside={
          <div className="rounded-[2px] border border-border bg-card px-5 py-4">
            <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Fuente
            </p>
            <div className="space-y-1 text-sm">
              <div>{judicialCase.source_name}</div>
              <div className="text-muted-foreground">{judicialCase.source_type}</div>
              {judicialCase.source_url ? (
                <a href={judicialCase.source_url} target="_blank" rel="noopener noreferrer" className={`inline-block ${LINK}`}>
                  Ver fuente oficial →
                </a>
              ) : null}
            </div>
          </div>
        }
      >
        <RecordSection title="Ficha procesal">
          <FieldList items={items} />
        </RecordSection>

        <RecordSection title="Actores revisados" count={actors.length}>
          {actors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actores revisados publicados.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {actors.map((actor) => (
                <div key={actor.id} className="py-3 text-sm">
                  <div className="font-medium">
                    {actor.organization_id ? (
                      <EntityLink kind="organization" id={actor.organization_id} className={LINK}>
                        {actor.actor_label}
                      </EntityLink>
                    ) : actor.politician_id ? (
                      <EntityLink kind="politician" id={actor.politician_id} className={LINK}>
                        {actor.actor_label}
                      </EntityLink>
                    ) : actor.party_id ? (
                      <ResponsiveLink href={`/partidos/${actor.party_id}`} className={LINK}>
                        {actor.actor_label}
                      </ResponsiveLink>
                    ) : (
                      actor.actor_label
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{actor.role || actor.actor_type}</div>
                </div>
              ))}
            </div>
          )}
        </RecordSection>

        <RecordSection title="Vínculos revisados" count={links.length}>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin vínculos revisados con contratos o subvenciones.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {links.map((link) => (
                <div key={link.id} className="py-3 text-sm">
                  <div className="font-medium">
                    {link.contract_id ? (
                      <ResponsiveLink href={`/contratos/${link.contract_id}`} className={LINK}>
                        {link.contract_title ?? "Contrato vinculado"}
                      </ResponsiveLink>
                    ) : link.subsidy_id ? (
                      <ResponsiveLink href={`/subvenciones/${link.subsidy_id}`} className={LINK}>
                        Subvención vinculada
                      </ResponsiveLink>
                    ) : link.organization_id ? (
                      <EntityLink kind="organization" id={link.organization_id} className={LINK}>
                        Organización vinculada
                      </EntityLink>
                    ) : (
                      "Vínculo revisado"
                    )}
                  </div>
                  {(link.contract_amount != null || link.contract_contractor) && (
                    <div className="text-xs text-muted-foreground">
                      {[formatAmount(link.contract_amount), link.contract_contractor].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">{link.link_reason}</div>
                </div>
              ))}
            </div>
          )}
        </RecordSection>
      </RecordLayout>
    </div>
  )
}
