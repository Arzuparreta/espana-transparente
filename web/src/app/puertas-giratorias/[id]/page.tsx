import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { EntityLink } from "@/components/domain/EntityLink"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { getRevolvingDoorCaseById } from "@/lib/data"
import type { RDCase, RDSource } from "@/app/puertas-giratorias/page"

export const revalidate = 3600

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const data = (await getRevolvingDoorCaseById(params.id)) as RDCase | null
  return { title: data?.person_name ?? "Puerta giratoria" }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-border/50 py-3 text-sm first:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  )
}

const SOURCE_LABEL: Record<RDSource["source_type"], string> = {
  primary: "Fuente primaria",
  secondary: "Fuente secundaria",
  discovery: "Descubrimiento",
}

export default async function RevolvingDoorDetailPage({ params }: PageProps) {
  const item = (await getRevolvingDoorCaseById(params.id)) as RDCase | null
  if (!item) notFound()

  const sources = (item.sources ?? []) as RDSource[]
  const primarySources = sources.filter((s) => s.source_type === "primary")
  const otherSources = sources.filter((s) => s.source_type !== "primary")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ContextTrail
        section={{ href: "/puertas-giratorias", label: "Puertas giratorias" }}
        current={item.person_name}
        meta={item.sector ?? undefined}
        fallbackHref="/puertas-giratorias"
        fallbackLabel="Volver a Puertas giratorias"
        related={[
          item.person_id
            ? { href: `/diputados/${item.person_id}`, label: "Ficha de la persona" }
            : null,
          item.organization_id
            ? {
                href: `/organizaciones/${item.organization_id}`,
                label: "Organización privada",
              }
            : null,
        ]}
      />
      <PageHeader
        title={item.person_name}
        description={`${item.public_role} → ${item.private_role} · ${item.private_organization}`}
        eyebrow={
          item.political_party ? (
            <PartyBadge acronym={item.political_party} partyId={null} />
          ) : undefined
        }
      />

      <div className="rounded-xl border border-border/70 bg-card/80 px-6 py-2">
        <dl>
          {item.person_id && (
            <Row label="Persona">
              <EntityLink
                kind="politician"
                id={item.person_id}
                className="underline-offset-2 hover:underline"
              >
                {item.person_name}
              </EntityLink>
            </Row>
          )}
          <Row label="Cargo público">
            {item.public_role}
            {item.public_organization ? ` · ${item.public_organization}` : ""}
          </Row>
          <Row label="Salida del cargo">{formatDate(item.public_exit_date)}</Row>
          <Row label="Cargo privado">
            {item.private_role} · {item.private_organization}
          </Row>
          <Row label="Inicio actividad privada">
            {formatDate(item.private_start_date)}
          </Row>
          {item.authorization_date && (
            <Row label="Autorización OCI">{formatDate(item.authorization_date)}</Row>
          )}
          {item.cooling_off_months != null && (
            <Row label="Cooling-off">
              {item.cooling_off_months} mes{item.cooling_off_months !== 1 ? "es" : ""}
            </Row>
          )}
          {item.sector && <Row label="Sector">{item.sector}</Row>}
        </dl>
      </div>

      {primarySources.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Fuentes primarias
          </h2>
          <ul className="space-y-1">
            {primarySources.map((s, i) => (
              <li key={`p-${i}`}>
                <a
                  href={s.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm hover:border-border hover:bg-card"
                >
                  <span className="truncate font-medium">{s.title ?? s.source_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.source_name}
                    {s.published_at ? ` · ${formatDate(s.published_at)}` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {otherSources.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Otras fuentes
          </h2>
          <ul className="space-y-1">
            {otherSources.map((s, i) => (
              <li key={`o-${i}`}>
                <a
                  href={s.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm hover:border-border hover:bg-card"
                >
                  <span className="truncate font-medium">{s.title ?? s.source_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[s.source_type]} · {s.source_name}
                    {s.published_at ? ` · ${formatDate(s.published_at)}` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <InfoPanel title="Sobre estos datos">
        Los casos de puertas giratorias publicados están verificados con al menos una fuente
        primaria (BOE, sentencia, registro mercantil, declaración oficial, etc.). El proceso
        de revisión está documentado en el repositorio público del proyecto.
      </InfoPanel>
    </div>
  )
}
