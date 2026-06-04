import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getJudicialCaseDetail, JUDICIAL_STATUS_LABEL } from "@/lib/data"
import type { JudicialStatus } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border/50 py-3 text-sm first:border-0 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  )
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

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/corrupcion", label: "Procesos judiciales" }}
        current={judicialCase.title}
        meta={JUDICIAL_STATUS_LABEL[judicialCase.procedural_status as JudicialStatus]}
        fallbackHref="/corrupcion"
        fallbackLabel="Volver a Procesos judiciales"
        related={[
          judicialCase.source_url
            ? { href: judicialCase.source_url, label: "Fuente oficial", external: true }
            : null,
        ]}
      />

      <PageHeader
        title={judicialCase.title}
        description="Detalle procesal publicado por fuentes oficiales. Los vínculos con entidades del portal requieren revisión previa."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 rounded-[2px] border border-border bg-card px-4 py-2 sm:px-6">
          <dl>
            <DetailRow label="Estado">
              {JUDICIAL_STATUS_LABEL[judicialCase.procedural_status as JudicialStatus]}
            </DetailRow>
            {judicialCase.offence_category && (
              <DetailRow label="Categoría">{judicialCase.offence_category}</DetailRow>
            )}
            {judicialCase.court_body && (
              <DetailRow label="Órgano">{judicialCase.court_body}</DetailRow>
            )}
            {judicialCase.territory && (
              <DetailRow label="Territorio">{judicialCase.territory}</DetailRow>
            )}
            {judicialCase.procedure_type && (
              <DetailRow label="Procedimiento">{judicialCase.procedure_type}</DetailRow>
            )}
            {judicialCase.summary && (
              <DetailRow label="Resumen">
                <span className="font-normal">{judicialCase.summary}</span>
              </DetailRow>
            )}
            <DetailRow label="Última verificación">{formatDate(judicialCase.last_verified_at)}</DetailRow>
          </dl>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fuente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>{judicialCase.source_name}</div>
              <div className="text-muted-foreground">{judicialCase.source_type}</div>
              {judicialCase.source_url ? (
                <a
                  href={judicialCase.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block underline-offset-2 hover:underline"
                >
                  Ver fuente oficial →
                </a>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actores revisados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {actors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin actores revisados publicados.</p>
            ) : (
              actors.map((actor) => (
                <div key={actor.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <div className="font-medium">
                    {actor.organization_id ? (
                      <EntityLink kind="organization" id={actor.organization_id} className="underline-offset-2 hover:underline">
                        {actor.actor_label}
                      </EntityLink>
                    ) : actor.politician_id ? (
                      <EntityLink kind="politician" id={actor.politician_id} className="underline-offset-2 hover:underline">
                        {actor.actor_label}
                      </EntityLink>
                    ) : actor.party_id ? (
                      <ResponsiveLink href={`/partidos/${actor.party_id}`} className="underline-offset-2 hover:underline">
                        {actor.actor_label}
                      </ResponsiveLink>
                    ) : (
                      actor.actor_label
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {actor.role || actor.actor_type}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vínculos revisados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin vínculos revisados con contratos o subvenciones.</p>
            ) : (
              links.map((link) => (
                <div key={link.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <div className="font-medium">
                    {link.contract_id ? (
                      <ResponsiveLink href={`/contratos/${link.contract_id}`} className="underline-offset-2 hover:underline">
                        {link.contract_title ?? "Contrato vinculado"}
                      </ResponsiveLink>
                    ) : link.subsidy_id ? (
                      <ResponsiveLink href={`/subvenciones/${link.subsidy_id}`} className="underline-offset-2 hover:underline">
                        Subvención vinculada
                      </ResponsiveLink>
                    ) : link.organization_id ? (
                      <EntityLink kind="organization" id={link.organization_id} className="underline-offset-2 hover:underline">
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
