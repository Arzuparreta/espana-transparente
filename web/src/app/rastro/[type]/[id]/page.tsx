import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { EntityTrail, EntityTrailSkeleton } from "@/components/domain/EntityTrail"
import { getEntityLabel } from "@/lib/data"

export const revalidate = 3600

type TrailType = "diputado" | "partido" | "organizacion"
type EntityType = "politician" | "party" | "organization"

const TYPE_MAP: Record<TrailType, EntityType> = {
  diputado: "politician",
  partido: "party",
  organizacion: "organization",
}

const SECTION_MAP: Record<TrailType, { href: string; label: string; groupLabel: string; fallbackHref: string; fallbackLabel: string }> = {
  diputado: { href: "/diputados", label: "Diputados", groupLabel: "Personas", fallbackHref: "/diputados", fallbackLabel: "Volver a Diputados" },
  partido: { href: "/partidos", label: "Partidos", groupLabel: "Personas", fallbackHref: "/partidos", fallbackLabel: "Volver a Partidos" },
  organizacion: { href: "/organizaciones", label: "Organizaciones", groupLabel: "Dinero", fallbackHref: "/organizaciones", fallbackLabel: "Volver a Organizaciones" },
}

const ENTITY_HREF: Record<TrailType, (id: string) => string> = {
  diputado: (id) => `/diputados/${id}`,
  partido: (id) => `/partidos/${id}`,
  organizacion: (id) => `/organizaciones/${id}`,
}

interface PageProps {
  params: Promise<{ type: string; id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { type, id } = await params
  const entityType = TYPE_MAP[type as TrailType]
  if (!entityType) return { title: "Rastro de conexiones" }
  const entity = await getEntityLabel(entityType, id)
  return { title: entity ? `Conexiones · ${entity.label}` : "Rastro de conexiones" }
}

export default async function RastroPage({ params }: PageProps) {
  const { type, id } = await params
  const entityType = TYPE_MAP[type as TrailType]
  if (!entityType) notFound()

  const [entity] = await Promise.all([getEntityLabel(entityType, id)])
  if (!entity) notFound()

  const section = SECTION_MAP[type as TrailType]
  const entityHref = ENTITY_HREF[type as TrailType](id)

  return (
    <div className="ui-page space-y-8">
      <ContextTrail
        section={{ href: section.href, label: section.label, groupLabel: section.groupLabel }}
        current={entity.label}
        meta={entity.subtitle}
        fallbackHref={entityHref}
        fallbackLabel={`Volver a ${entity.label}`}
        related={[{ href: entityHref, label: "Perfil completo" }]}
      />
      <PageHeader
        title={entity.label}
        description={entity.subtitle}
        eyebrow={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Rastro de conexiones
          </span>
        }
      />
      <Suspense fallback={<EntityTrailSkeleton />}>
        <EntityTrail entityType={entityType} entityId={id} />
      </Suspense>
    </div>
  )
}
