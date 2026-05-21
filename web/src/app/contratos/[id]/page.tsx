import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ShareButton } from "@/components/domain/ShareButton"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getContractDetail, getPartyAcronymMap } from "@/lib/data"
import { BRAND_URL } from "@/lib/brand"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { contract } = await getContractDetail(id)
  return { title: contract?.title ?? "Contrato" }
}

function formatAmount(amount: number | null, currency = "EUR"): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
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

const ADMIN_LEVEL: Record<string, string> = {
  state: "Administración General del Estado",
  autonomic: "Comunidad Autónoma",
  municipal: "Entidad Local",
}

function buildShareText(contract: { title?: string | null; amount?: number | null; awarding_body?: string | null; contractor?: string | null }): string {
  const amountStr = contract.amount != null
    ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(contract.amount)
    : null
  const parts: string[] = []
  if (contract.awarding_body) parts.push(contract.awarding_body)
  if (amountStr) parts.push(`adjudicó ${amountStr}`)
  if (contract.contractor) parts.push(`a ${contract.contractor}`)
  return parts.length > 0
    ? `${parts.join(" ")}. Fuente: España Transparente`
    : `Contrato público. Fuente: España Transparente`
}

export default async function ContractDetailPage({ params }: PageProps) {
  const { id } = await params
  const [{ contract, responsible }, partyMap] = await Promise.all([
    getContractDetail(id),
    getPartyAcronymMap(),
  ])
  if (!contract) notFound()
  const responsiblePartyId = responsible?.political_party
    ? partyMap[responsible.political_party.toLowerCase()] ?? null
    : null

  const dateStr = contract.date
    ? new Date(contract.date).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ContextTrail
        section={{ href: "/contratos", label: "Contratos" }}
        current={contract.title}
        meta={contract.contract_folder_id ? `Exp. ${contract.contract_folder_id}` : undefined}
        fallbackHref="/contratos"
        fallbackLabel="Volver a Contratos"
        related={[
          contract.awarding_body_organization_id
            ? {
                href: `/organizaciones/${contract.awarding_body_organization_id}`,
                label: "Órgano adjudicador",
              }
            : null,
          contract.ministry_normalized
            ? {
                href: `/contratos?ministry=${encodeURIComponent(contract.ministry_normalized)}`,
                label: "Ministerio",
              }
            : null,
          responsible?.politician_id
            ? {
                href: `/diputados/${responsible.politician_id}`,
                label: "Responsable político",
              }
            : null,
          contract.contractor ? { href: "/organizaciones", label: "Adjudicatario" } : null,
          contract.source_url
            ? {
                href: contract.source_url,
                label: "Fuente oficial",
                external: true,
              }
            : null,
        ]}
      />
      <PageHeader
        title={contract.title}
        description={contract.contract_folder_id ? `Expediente ${contract.contract_folder_id}` : "Detalle del contrato público"}
      />

      {/* Importe destacado */}
      <div className="rounded-[2px] border border-border bg-card px-6 py-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Importe sin IVA</p>
        <p className="mt-1 font-mono text-3xl font-bold">
          {formatAmount(contract.amount, contract.currency ?? "EUR")}
        </p>
      </div>

      {/* Tabla de datos */}
      <div className="rounded-[2px] border border-border bg-card px-6 py-2">
        <dl>
          {dateStr && <Row label="Fecha">{dateStr}</Row>}
          {contract.contract_type && <Row label="Tipo">{contract.contract_type}</Row>}
          {contract.awarding_body && (
            <Row label="Órgano convocante">
              {contract.awarding_body_organization_id ? (
                <EntityLink
                  kind="organization"
                  id={contract.awarding_body_organization_id}
                  className="underline-offset-2 hover:underline"
                >
                  {contract.awarding_body}
                </EntityLink>
              ) : (
                contract.awarding_body
              )}
            </Row>
          )}
          {contract.contractor && <Row label="Adjudicatario">{contract.contractor}</Row>}
          {contract.ministry_normalized && (
            <Row label="Ministerio">
              <ResponsiveLink
                href={`/contratos?ministry=${encodeURIComponent(contract.ministry_normalized)}`}
                className="underline-offset-2 hover:underline"
              >
                {contract.ministry_normalized}
              </ResponsiveLink>
            </Row>
          )}
          {contract.region && <Row label="Región">{contract.region}</Row>}
          {contract.administration_level && (
            <Row label="Nivel administrativo">
              {ADMIN_LEVEL[contract.administration_level] ?? contract.administration_level}
            </Row>
          )}
          {contract.cpv_code && (
            <Row label="Código CPV">{contract.cpv_code}</Row>
          )}
          {contract.description && (
            <Row label="Descripción">
              <span className="font-normal">{contract.description}</span>
            </Row>
          )}
        </dl>
      </div>

      {/* Responsable político */}
      {responsible && (
        <div className="rounded-[2px] border border-border bg-card px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Responsable político
          </p>
          <div className="flex min-w-0 items-start justify-between gap-4">
            <div className="min-w-0">
              {responsible.politician_id ? (
                <EntityLink
                  kind="politician"
                  id={responsible.politician_id}
                  className="font-semibold underline-offset-2 hover:underline"
                >
                  {responsible.person_name}
                </EntityLink>
              ) : (
                <p className="font-semibold">{responsible.person_name}</p>
              )}
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
        Plataforma de Contratación del Sector Público (PCSP) · Ministerio de Hacienda.
        {contract.source_url && (
          <>
            {" "}
            <a
              href={contract.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Ver expediente oficial →
            </a>
          </>
        )}
      </InfoPanel>

      <ShareButton
        text={buildShareText(contract)}
        url={`${BRAND_URL}/contratos/${id}`}
      />
    </div>
  )
}
