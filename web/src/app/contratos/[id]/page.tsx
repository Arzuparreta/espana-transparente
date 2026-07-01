import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { ShareButton } from "@/components/domain/ShareButton"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import { FieldList, type FieldItem } from "@/components/domain/FieldList"
import { StatGrid } from "@/components/domain/StatGrid"
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

const LINK = "underline-offset-2 hover:underline"

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
  const showAwardDate = awardDateStr && awardDateStr !== dateStr
  const budgetAmount = contract.amount
  const awardAmount = contract.award_amount
  const showAwardAmount = awardAmount != null && budgetAmount != null
    && Math.abs(awardAmount - budgetAmount) / budgetAmount > 0.01

  const items: FieldItem[] = []
  if (dateStr) items.push({ label: "Fecha", value: dateStr, mono: true })
  if (contract.contract_type) items.push({ label: "Tipo", value: contract.contract_type })
  if (contract.awarding_body) {
    items.push({
      label: "Órgano convocante",
      value: contract.awarding_body_organization_id ? (
        <EntityLink kind="organization" id={contract.awarding_body_organization_id} className={LINK}>
          {contract.awarding_body}
        </EntityLink>
      ) : (
        contract.awarding_body
      ),
    })
  }
  if (contract.contractor) items.push({ label: "Adjudicatario", value: contract.contractor })
  if (contract.contractor_nif) items.push({ label: "NIF", value: contract.contractor_nif, mono: true })
  if (contract.contractor_is_sme || contract.contractor_is_ute) {
    items.push({
      label: "Tipo de empresa",
      value: (
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
      ),
    })
  }
  if (contract.ministry_normalized) {
    items.push({
      label: "Ministerio",
      value: (
        <ResponsiveLink href={`/contratos?ministry=${encodeURIComponent(contract.ministry_normalized)}`} className={LINK}>
          {contract.ministry_normalized}
        </ResponsiveLink>
      ),
    })
  }
  if (contract.region) items.push({ label: "Región", value: contract.region })
  if (contract.administration_level) {
    items.push({ label: "Nivel administrativo", value: ADMIN_LEVEL[contract.administration_level] ?? contract.administration_level })
  }
  if (contract.contract_number) items.push({ label: "Nº de contrato", value: contract.contract_number, mono: true })
  if (contract.received_tender_quantity != null) items.push({ label: "Ofertas recibidas", value: contract.received_tender_quantity, mono: true })
  if (showAwardDate) items.push({ label: "Fecha de adjudicación", value: awardDateStr, mono: true })
  if (contract.cpv_code) items.push({ label: "Código CPV", value: contract.cpv_code, mono: true })
  if (contract.description) items.push({ label: "Descripción", value: contract.description })

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
            ? { href: `/organizaciones/${contract.awarding_body_organization_id}`, label: "Órgano adjudicador" }
            : null,
          contract.ministry_normalized
            ? { href: `/contratos?ministry=${encodeURIComponent(contract.ministry_normalized)}`, label: "Ministerio" }
            : null,
          responsible?.politician_id
            ? { href: `/diputados/${responsible.politician_id}`, label: "Responsable político" }
            : responsible?.official_id
              ? { href: `/cargos/${responsible.official_id}`, label: "Responsable político" }
              : null,
          contract.contractor ? { href: "/organizaciones", label: "Adjudicatario" } : null,
          contract.source_url
            ? { href: contract.source_url, label: "Fuente oficial", external: true }
            : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Contrato{contract.contract_folder_id ? ` · Exp. ${contract.contract_folder_id}` : ""}
              </span>
            }
            title={contract.title}
            description="Detalle del contrato público enlazado a su órgano, adjudicatario y responsable."
          />
        }
        aside={
          <>
            {responsible && (
              <div className="rounded-[2px] border border-border bg-card px-5 py-4">
                <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Responsable político
                </p>
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    {responsible.politician_id ? (
                      <EntityLink kind="politician" id={responsible.politician_id} className={`font-semibold ${LINK}`}>
                        {responsible.person_name}
                      </EntityLink>
                    ) : responsible.official_id ? (
                      <EntityLink kind="official" id={responsible.official_id} className={`font-semibold ${LINK}`}>
                        {responsible.person_name}
                      </EntityLink>
                    ) : (
                      <p className="font-semibold">{responsible.person_name}</p>
                    )}
                    {responsible.ministry && <p className="mt-0.5 text-sm text-muted-foreground">{responsible.ministry}</p>}
                    {responsible.government && <p className="text-xs text-muted-foreground">{responsible.government}</p>}
                  </div>
                  {responsible.political_party ? (
                    <PartyBadge acronym={responsible.political_party} partyId={responsiblePartyId} className="text-xs" />
                  ) : null}
                </div>
              </div>
            )}

            {judicialLinks.length > 0 && (
              <div className="rounded-[2px] border border-border bg-card px-5 py-4">
                <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Procedimientos relacionados
                </p>
                <div className="space-y-3">
                  {judicialLinks.map((link) => (
                    <div key={link.id} className="text-sm">
                      <ResponsiveLink href={`/corrupcion/${link.case_id}`} className={`font-semibold ${LINK}`}>
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
                  <a href={contract.source_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    Ver expediente oficial →
                  </a>
                </>
              )}
            </InfoPanel>

            <ShareButton text={buildShareText(contract)} url={`${BRAND_URL}/contratos/${id}`} />
          </>
        }
      >
        <StatGrid
          variant="flat"
          items={[
            { label: "Presupuesto sin IVA", value: formatAmount(budgetAmount, contract.currency ?? "EUR") },
            ...(showAwardAmount && awardAmount != null && budgetAmount != null
              ? [
                  {
                    label: "Importe adjudicado sin IVA",
                    value: formatAmount(awardAmount, contract.currency ?? "EUR"),
                    valueClassName: "text-accent",
                    hint: `${awardAmount < budgetAmount ? "−" : "+"}${Math.round(Math.abs(1 - awardAmount / budgetAmount) * 100)}% sobre el presupuesto`,
                  },
                ]
              : []),
          ]}
        />

        <RecordSection title="Datos del expediente">
          <FieldList items={items} />
        </RecordSection>
      </RecordLayout>
    </div>
  )
}
