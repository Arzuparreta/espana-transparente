import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { EntityLink } from "@/components/domain/EntityLink"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getPartyAcronymMap, getSubsidyDetail } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { subsidy } = await getSubsidyDetail(id)
  return { title: subsidy?.convocatoria ?? subsidy?.beneficiario ?? "Subvención" }
}

const NIVEL1_LABELS: Record<string, string> = {
  ESTADO: "Estatal",
  AUTONOMICA: "Autonómica",
  LOCAL: "Local",
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 border-t border-border/50 py-3 text-sm first:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children}</dd>
    </div>
  )
}

export default async function SubsidyDetailPage({ params }: PageProps) {
  const { id } = await params
  const [{ subsidy, responsible, beneficiaryOrg, grantingOrg }, partyMap] = await Promise.all([
    getSubsidyDetail(id),
    getPartyAcronymMap(),
  ])
  if (!subsidy) notFound()
  const responsiblePartyId = responsible?.political_party
    ? partyMap[responsible.political_party.toLowerCase()] ?? null
    : null

  const dateStr = subsidy.fecha_concesion
    ? new Date(subsidy.fecha_concesion).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  const nivelLabel = NIVEL1_LABELS[subsidy.nivel1 ?? ""] ?? subsidy.nivel1 ?? null
  const titleText = subsidy.convocatoria ?? subsidy.beneficiario ?? `BDNS ${subsidy.bdns_id}`

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ContextTrail
        section={{ href: "/subvenciones", label: "Subvenciones" }}
        current={titleText}
        meta={subsidy.bdns_id ? `BDNS ${subsidy.bdns_id}` : undefined}
        fallbackHref="/subvenciones"
        fallbackLabel="Volver a Subvenciones"
        related={[
          beneficiaryOrg
            ? { href: `/organizaciones/${beneficiaryOrg.id}`, label: beneficiaryOrg.name, meta: "Beneficiario" }
            : null,
          grantingOrg
            ? { href: `/organizaciones/${grantingOrg.id}`, label: grantingOrg.name, meta: "Concedente" }
            : null,
          responsible?.politician_id
            ? { href: `/diputados/${responsible.politician_id}`, label: responsible.person_name ?? "Responsable", meta: "Responsable" }
            : null,
          subsidy.ministry_normalized
            ? {
                href: `/subvenciones?ministry=${encodeURIComponent(subsidy.ministry_normalized)}`,
                label: subsidy.ministry_normalized,
                meta: "Ministerio",
              }
            : null,
          subsidy.source_url
            ? { href: subsidy.source_url, label: "Convocatoria oficial", external: true }
            : null,
        ]}
      />
      <PageHeader
        title={titleText}
        description={`BDNS ${subsidy.bdns_id}${subsidy.cod_concesion ? ` · ${subsidy.cod_concesion}` : ""}`}
      />

      <div className="rounded-[2px] border border-border bg-card px-6 py-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Importe</p>
        <p className="mt-1 font-mono text-3xl font-bold">{formatAmount(subsidy.importe)}</p>
      </div>

      <div className="rounded-[2px] border border-border bg-card px-6 py-2">
        <dl>
          {dateStr && <Row label="Fecha concesión">{dateStr}</Row>}
          {subsidy.instrumento && <Row label="Instrumento">{subsidy.instrumento}</Row>}
          {nivelLabel && <Row label="Nivel">{nivelLabel}</Row>}
          {subsidy.beneficiario && (
            <Row label="Beneficiario">
              {beneficiaryOrg ? (
                <EntityLink kind="organization" id={beneficiaryOrg.id} className="underline-offset-2 hover:underline">
                  {beneficiaryOrg.name}
                </EntityLink>
              ) : (
                subsidy.beneficiario
              )}
            </Row>
          )}
          {(subsidy.nivel3 || grantingOrg) && (
            <Row label="Órgano concedente">
              {grantingOrg ? (
                <EntityLink kind="organization" id={grantingOrg.id} className="underline-offset-2 hover:underline">
                  {grantingOrg.name}
                </EntityLink>
              ) : (
                subsidy.nivel3
              )}
            </Row>
          )}
          {subsidy.nivel2 && <Row label="Territorio">{subsidy.nivel2}</Row>}
          {subsidy.ministry_normalized && (
            <Row label="Ministerio">
              <ResponsiveLink
                href={`/subvenciones?ministry=${encodeURIComponent(subsidy.ministry_normalized)}`}
                className="underline-offset-2 hover:underline"
              >
                {subsidy.ministry_normalized}
              </ResponsiveLink>
            </Row>
          )}
          {subsidy.numero_convocatoria && (
            <Row label="Convocatoria">{subsidy.numero_convocatoria}</Row>
          )}
        </dl>
      </div>

      {responsible && (
        <div className="rounded-[2px] border border-border bg-card px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Responsable político
          </p>
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              <EntityLink kind="politician" id={responsible.politician_id} className="font-semibold underline-offset-2 hover:underline">
                {responsible.person_name}
              </EntityLink>
              {responsible.ministry && (
                <p className="mt-0.5 text-sm text-muted-foreground">{responsible.ministry}</p>
              )}
              {responsible.government && (
                <p className="text-xs text-muted-foreground">{responsible.government}</p>
              )}
            </div>
            {responsible.political_party ? (
              <PartyBadge
                acronym={responsible.political_party}
                partyId={responsiblePartyId}
                className="text-xs"
              />
            ) : null}
          </div>
        </div>
      )}

      <InfoPanel title="Fuente">
        Base de Datos Nacional de Subvenciones (BDNS) · Intervención General de la Administración del Estado (IGAE).
        {subsidy.source_url && (
          <>
            {" "}
            <a
              href={subsidy.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Ver convocatoria oficial →
            </a>
          </>
        )}
      </InfoPanel>
    </div>
  )
}
