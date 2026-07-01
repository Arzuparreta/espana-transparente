import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import { FieldList, type FieldItem } from "@/components/domain/FieldList"
import { getLobbyingGroupById } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

const LINK = "underline-offset-2 hover:underline"

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { group } = await getLobbyingGroupById(id)
  return { title: group?.name ?? "Grupo de interés" }
}

export default async function GrupoDeInteresDetailPage({ params }: PageProps) {
  const { id } = await params
  const { group, links } = await getLobbyingGroupById(id)
  if (!group) notFound()

  const address = [group.address_street, group.address_locality, group.address_postal_code, group.address_country]
    .filter(Boolean)
    .join(", ")

  const items: FieldItem[] = []
  if (group.category) items.push({ label: "Categoría", value: group.category })
  if (group.subcategory) items.push({ label: "Subcategoría", value: group.subcategory })
  if (group.objectives) items.push({ label: "Objetivos declarados", value: group.objectives })
  if (group.activities) items.push({ label: "Actividades declaradas", value: group.activities })
  if (group.interest_areas) items.push({ label: "Áreas de interés", value: group.interest_areas })
  if (group.legal_rep_name) {
    items.push({ label: "Representante legal", value: `${group.legal_rep_name}${group.legal_rep_role ? ` · ${group.legal_rep_role}` : ""}` })
  }
  if (group.contact_name) {
    items.push({ label: "Contacto", value: `${group.contact_name}${group.contact_role ? ` · ${group.contact_role}` : ""}` })
  }
  if (address) items.push({ label: "Dirección", value: address })
  items.push({
    label: "Última actualización",
    value: group.updated_at
      ? new Date(group.updated_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
      : "—",
    mono: true,
  })

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/grupos-de-interes", label: "Grupos de interés" }}
        current={group.name}
        meta={group.category ?? undefined}
        fallbackHref="/grupos-de-interes"
        fallbackLabel="Volver a Grupos de interés"
        related={[
          group.source_url ? { href: group.source_url, label: "Ficha en CNMC", external: true } : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Grupo de interés{group.category ? ` · ${group.category}` : ""}
              </span>
            }
            title={group.name}
            description="Ficha del Registro de Grupos de Interés de la CNMC. Los vínculos con organizaciones del portal requieren revisión previa."
          />
        }
        aside={
          <div className="rounded-[2px] border border-border bg-card px-5 py-4">
            <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Fuente
            </p>
            <div className="space-y-1 text-sm">
              <div>Registro de Grupos de Interés CNMC</div>
              {group.source_url ? (
                <a href={group.source_url} target="_blank" rel="noopener noreferrer" className={`inline-block ${LINK}`}>
                  Ver ficha oficial →
                </a>
              ) : null}
            </div>
          </div>
        }
      >
        <RecordSection title="Ficha">
          <FieldList items={items} />
        </RecordSection>

        <RecordSection title="Vínculos revisados" count={links.length}>
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin vínculos revisados con organizaciones del portal.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {links.map((link) => {
                const org = (link.organizations as { id?: string; name?: string } | null) ?? null
                return (
                  <div key={link.id} className="py-3 text-sm">
                    <div className="font-medium">
                      {org?.id ? (
                        <EntityLink kind="organization" id={org.id} className={LINK}>
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
              })}
            </div>
          )}
        </RecordSection>
      </RecordLayout>
    </div>
  )
}
