import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ShareButton } from "@/components/domain/ShareButton"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getContractDetail, getJudicialLinksForContract, getPartyAcronymMap, JUDICIAL_STATUS_LABEL } from "@/lib/data"
import type { JudicialStatus } from "@/lib/data"
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

function formatDateLabel(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-border/50 py-3 text-sm first:border-0 sm:grid-cols-[10rem_1fr] sm:gap-3">
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

function buildShareText(contract: { title?: string | null; amount?: number | null; award_amount?: number | null; awarding_body?: string | null; contractor?: string | null }): string {
  const displayAmount = contract.award_amount ?? contract.amount
  const amountStr = displayAmount != null
    ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(displayAmount)
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
  const organizationIds = [
    contract.awarding_body_organization_id,
    contract.contractor_organization_id,
  ].filter((value): value is string => Boolean(value))
  const judicialLinks = await getJudicialLinksForContract(id, organizationIds)
  const responsiblePartyId = responsible?.political_party
    ? partyMap[responsible.political_party.toLowerCase()] ?? null
    : null

  const dateStr = formatDateLabel(contract.date)
  const awardDateStr = formatDateLabel(contract.award_date)
  // Only show award date separately if it differs from the main date
  const showAwardDate = awardDateStr && awardDateStr !== dateStr
  const budgetAmount = contract.amount
  const awardAmount = contract.award_amount
  // Show award amount distinctly when it differs from budget by > 1%
  const showAwardAmount = awardAmount != null && budgetAmount != null
    && Math.abs(awardAmount - budgetAmount) / budgetAmount > 0.01

  return (
    <div className="ui-page">
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
            : responsible?.official_id
              ? {
                  href: `/cargos/${responsible.official_id}`,
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 rounded-[2px] border border-border bg-card px-4 py-2 sm:px-6">
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
            {contract.contractor_nif && (
              <Row label="NIF">
                <span className="font-mono">{contract.contractor_nif}</span>
              </Row>
            )}
            {(contract.contractor_is_sme || contract.contractor_is_ute) && (
              <Row label="Tipo de empresa">
                <div className="flex flex-wrap gap-2">
                  {contract.contractor_is_sme && (
                    <span className="rounded-[2px] border border-accent/35 bg-accent/10 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-accent">
                      PYME
                    </span>
                  )}
                  {contract.contractor_is_ute && (
                    <span className="rounded-[2px] border border-border bg-muted px-2 py-0.5 font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      UTE
                    </span>
                  )}
                </div>
              </Row>
            )}
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
            {contract.contract_number && (
              <Row label="Nº de contrato">
                <span className="font-mono">{contract.contract_number}</span>
              </Row>
            )}
            {contract.received_tender_quantity != null && (
              <Row label="Ofertas recibidas">
                <span className="font-mono tabular-nums">{contract.received_tender_quantity}</span>
              </Row>
            )}
            {showAwardDate && (
              <Row label="Fecha de adjudicación">{awardDateStr}</Row>
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

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-[2px] border border-border bg-card px-5 py-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Presupuesto sin IVA</p>
            <p className="mt-1 break-words font-mono text-3xl font-bold">
              {formatAmount(budgetAmount, contract.currency ?? "EUR")}
            </p>
          </div>

          {showAwardAmount && (
            <div className="rounded-[2px] border border-accent/35 bg-accent/[0.03] px-5 py-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Importe adjudicado sin IVA
              </p>
              <p className="mt-1 break-words font-mono text-3xl font-bold text-accent">
                {formatAmount(awardAmount, contract.currency ?? "EUR")}
              </p>
              {awardAmount != null && budgetAmount != null && (
                <p className="mt-1 font-mono text-xs tabular-nums text-accent/70">
                  {awardAmount < budgetAmount ? "−" : "+"}
                  {Math.round(Math.abs(1 - awardAmount / budgetAmount) * 100)}% sobre el presupuesto
                </p>
              )}
            </div>
          )}

          {responsible && (
            <div className="rounded-[2px] border border-border bg-card px-5 py-4">
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
                  ) : responsible.official_id ? (
                    <EntityLink
                      kind="official"
                      id={responsible.official_id}
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

          {judicialLinks.length > 0 && (
            <div className="rounded-[2px] border border-border bg-card px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Procedimientos relacionados
              </p>
              <div className="space-y-3">
                {judicialLinks.map((link) => (
                  <div key={link.id} className="text-sm">
                    <ResponsiveLink
                      href={`/corrupcion/${link.case_id}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {link.case_title}
                    </ResponsiveLink>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {JUDICIAL_STATUS_LABEL[link.procedural_status as JudicialStatus]}
                      {link.offence_category ? ` · ${link.offence_category}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{link.link_reason}</p>
                  </div>
                ))}
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
        </aside>
      </div>
    </div>
  )
}
