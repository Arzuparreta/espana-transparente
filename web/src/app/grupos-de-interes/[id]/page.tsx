import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { getLobbyingGroupById } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { group } = await getLobbyingGroupById(id)
  return { title: group?.name ?? "Grupo de interés" }
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border/50 py-3 text-sm first:border-0 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  )
}

export default async function GrupoDeInteresDetailPage({ params }: PageProps) {
  const { id } = await params
  const { group, links } = await getLobbyingGroupById(id)
  if (!group) notFound()

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/grupos-de-interes", label: "Grupos de interés" }}
        current={group.name}
        meta={group.category ?? undefined}
        fallbackHref="/grupos-de-interes"
        fallbackLabel="Volver a Grupos de interés"
        related={[
          group.source_url
            ? { href: group.source_url, label: "Ficha en CNMC", external: true }
            : null,
        ]}
      />

      <PageHeader
        title={group.name}
        description="Ficha del Registro de Grupos de Interés de la CNMC. Los vínculos con organizaciones del portal requieren revisión previa."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 rounded-[2px] border border-border bg-card px-4 py-2 sm:px-6">
          <dl>
            {group.category && (
              <DetailRow label="Categoría">{group.category}</DetailRow>
            )}
            {group.subcategory && (
              <DetailRow label="Subcategoría">{group.subcategory}</DetailRow>
            )}
            {group.objectives && (
              <DetailRow label="Objetivos declarados">
                <span className="font-normal">{group.objectives}</span>
              </DetailRow>
            )}
            {group.activities && (
              <DetailRow label="Actividades declaradas">
                <span className="font-normal">{group.activities}</span>
              </DetailRow>
            )}
            {group.interest_areas && (
              <DetailRow label="Áreas de interés">
                <span className="font-normal">{group.interest_areas}</span>
              </DetailRow>
            )}
            {group.legal_rep_name && (
              <DetailRow label="Representante legal">
                {group.legal_rep_name}
                {group.legal_rep_role ? ` · ${group.legal_rep_role}` : ""}
              </DetailRow>
            )}
            {group.contact_name && (
              <DetailRow label="Contacto">
                {group.contact_name}
                {group.contact_role ? ` · ${group.contact_role}` : ""}
              </DetailRow>
            )}
            {(group.address_street || group.address_locality || group.address_postal_code) && (
              <DetailRow label="Dirección">
                <span className="font-normal">
                  {[
                    group.address_street,
                    group.address_locality,
                    group.address_postal_code,
                    group.address_country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </DetailRow>
            )}
            <DetailRow label="Última actualización">
              {group.updated_at
                ? new Date(group.updated_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </DetailRow>
          </dl>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fuente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>Registro de Grupos de Interés CNMC</div>
              {group.source_url ? (
                <a
                  href={group.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block underline-offset-2 hover:underline"
                >
                  Ver ficha oficial →
                </a>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vínculos revisados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin vínculos revisados con organizaciones del portal.
            </p>
          ) : (
            links.map((link) => {
              const org = (link.organizations as { id?: string; name?: string } | null) ?? null
              return (
                <div key={link.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <div className="font-medium">
                    {org?.id ? (
                      <EntityLink
                        kind="organization"
                        id={org.id}
                        className="underline-offset-2 hover:underline"
                      >
                        {org.name ?? "Organización vinculada"}
                      </EntityLink>
                    ) : (
                      "Organización vinculada"
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {link.match_method}
                    {link.confidence ? ` · confianza ${link.confidence}` : ""}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
