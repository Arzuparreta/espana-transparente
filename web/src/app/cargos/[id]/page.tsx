import { notFound } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { getOfficialDetail, getPartyAcronymMap } from "@/lib/data"
import type { PublicOfficialPosition } from "@/lib/data"
import { getResponsivePhoto } from "@/lib/photos"

export const revalidate = 3600 * 24

interface PageProps {
  params: Promise<{ id: string }>
}

const POSITION_LABELS: Record<string, string> = {
  presidente_gobierno: "Presidente del Gobierno",
  vicepresidente: "Vicepresidenta/e del Gobierno",
  ministro: "Ministra/o",
  presidente_autonomico: "Presidenta/e autonómica/o",
  consejero: "Consejera/o",
  alcalde: "Alcaldesa/e",
}

const ADMIN_LEVEL_SECTION: Record<string, { href: string; label: string }> = {
  state: { href: "/gobierno", label: "Gobierno" },
  autonomic: { href: "/territorio", label: "Comunidades autónomas" },
  municipal: { href: "/territorio", label: "Municipios" },
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function positionLabel(position: PublicOfficialPosition): string {
  return POSITION_LABELS[position.position_type ?? ""] ?? position.position_type ?? "Cargo"
}

function initialsFor(fullName: string): string {
  const parts = fullName.split(" ").filter(Boolean)
  return [parts[0]?.charAt(0), parts[parts.length - 1]?.charAt(0)]
    .filter(Boolean)
    .join("")
    .toUpperCase()
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { official } = await getOfficialDetail(id)
  return { title: official?.full_name ?? "Cargo público" }
}

export default async function CargoDetailPage({ params }: PageProps) {
  const { id } = await params
  const { official, positions } = await getOfficialDetail(id)
  if (!official) notFound()

  const partyMap = await getPartyAcronymMap()
  const partyId = official.political_party
    ? partyMap[official.political_party.toLowerCase()] ?? null
    : null

  const photo = getResponsivePhoto(official.photo_url, official.photo_variants)
  const current = positions.find((p) => !p.end_date) ?? positions[0] ?? null
  const description = current
    ? `${positionLabel(current)}${current.organization_name ? ` · ${current.organization_name}` : ""}`
    : undefined

  const section = ADMIN_LEVEL_SECTION[official.administration_level ?? ""] ?? ADMIN_LEVEL_SECTION.state

  return (
    <div className="ui-page">
      <ContextTrail
        section={section}
        current={official.full_name}
        fallbackHref={section.href}
        fallbackLabel={`Volver a ${section.label}`}
        related={[
          official.source_url
            ? { href: official.source_url, label: "Wikidata", external: true }
            : null,
        ]}
      />
      <PageHeader
        title={official.full_name}
        description={description}
        eyebrow={
          <>
            <Avatar className="size-14 shrink-0">
              <AvatarImage
                src={photo.src}
                srcSet={photo.srcSet}
                sizes={photo.sizes}
                decoding="async"
                alt={official.full_name}
              />
              <AvatarFallback className="text-base">{initialsFor(official.full_name)}</AvatarFallback>
            </Avatar>
            {official.political_party ? (
              <PartyBadge acronym={official.political_party} partyId={partyId} />
            ) : null}
          </>
        }
      />

      <div className="rounded-[2px] border border-border bg-card px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Cargos ocupados
        </h2>
        <div className="mt-3 space-y-3">
          {positions.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Sin cargos registrados.</p>
          ) : (
            positions.map((position) => (
              <div
                key={position.id}
                className="flex flex-wrap items-start justify-between gap-3 border-t border-border/50 py-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {positionLabel(position)}
                  </div>
                  <div className="mt-0.5 font-medium">
                    {position.organization_name ?? "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {[position.territory_name, position.government].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(position.start_date)}
                    {position.end_date ? ` – ${formatDate(position.end_date)}` : " – actualidad"}
                  </div>
                </div>
                {position.source_url && (
                  <a
                    href={position.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Fuente →
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <InfoPanel title="Fuente">
        Identidad y filiación política a partir de Wikidata; cargos a partir de fuentes oficiales
        (BOE, BOA, BOCM, diarios oficiales autonómicos y municipales) recopiladas en el registro
        de responsabilidades.
        {official.source_url && (
          <>
            {" "}
            <a
              href={official.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Ver en Wikidata →
            </a>
          </>
        )}
      </InfoPanel>
    </div>
  )
}
