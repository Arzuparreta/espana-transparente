import { notFound } from "next/navigation"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { getContractDetail } from "@/lib/data"

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

export default async function ContractDetailPage({ params }: PageProps) {
  const { id } = await params
  const { contract, responsible } = await getContractDetail(id)
  if (!contract) notFound()

  const dateStr = contract.date
    ? new Date(contract.date).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={contract.title}
        description={contract.contract_folder_id ? `Expediente ${contract.contract_folder_id}` : "Detalle del contrato público"}
      />

      {/* Importe destacado */}
      <div className="rounded-xl border border-border/70 bg-card/80 px-6 py-5">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Importe sin IVA</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {formatAmount(contract.amount, contract.currency ?? "EUR")}
        </p>
      </div>

      {/* Tabla de datos */}
      <div className="rounded-xl border border-border/70 bg-card/80 px-6 py-2">
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
            <Row label="Ministerio">{contract.ministry_normalized}</Row>
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
        <div className="rounded-xl border border-border/70 bg-card/80 px-6 py-4">
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
            {responsible.political_party && (
              <span className="shrink-0 rounded-full border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-medium">
                {responsible.political_party}
              </span>
            )}
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
    </div>
  )
}
