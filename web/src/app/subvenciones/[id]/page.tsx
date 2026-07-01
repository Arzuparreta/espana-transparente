import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { EntityLink } from "@/components/domain/EntityLink"
import { PartyBadge } from "@/components/domain/PartyBadge"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import { FieldList, type FieldItem } from "@/components/domain/FieldList"
import { StatGrid } from "@/components/domain/StatGrid"
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

const LINK = "underline-offset-2 hover:underline"

function formatAmount(amount: number | null): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount)
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

  const items: FieldItem[] = []
  if (dateStr) items.push({ label: "Fecha concesión", value: dateStr, mono: true })
  if (subsidy.instrumento) items.push({ label: "Instrumento", value: subsidy.instrumento })
  if (nivelLabel) items.push({ label: "Nivel", value: nivelLabel })
  if (subsidy.beneficiario) {
    items.push({
      label: "Beneficiario",
      value: beneficiaryOrg ? (
        <EntityLink kind="organization" id={beneficiaryOrg.id} className={LINK}>
          {beneficiaryOrg.name}
        </EntityLink>
      ) : (
        subsidy.beneficiario
      ),
    })
  }
  if (subsidy.nivel3 || grantingOrg) {
    items.push({
      label: "Órgano concedente",
      value: grantingOrg ? (
        <EntityLink kind="organization" id={grantingOrg.id} className={LINK}>
          {grantingOrg.name}
        </EntityLink>
      ) : (
        subsidy.nivel3
      ),
    })
  }
  if (subsidy.nivel2) items.push({ label: "Territorio", value: subsidy.nivel2 })
  if (subsidy.ministry_normalized) {
    items.push({
      label: "Ministerio",
      value: (
        <ResponsiveLink href={`/subvenciones?ministry=${encodeURIComponent(subsidy.ministry_normalized)}`} className={LINK}>
          {subsidy.ministry_normalized}
        </ResponsiveLink>
      ),
    })
  }
  if (subsidy.numero_convocatoria) items.push({ label: "Convocatoria", value: subsidy.numero_convocatoria })

  return (
    <div className="ui-page">
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
            : responsible?.official_id
              ? { href: `/cargos/${responsible.official_id}`, label: responsible.person_name ?? "Responsable", meta: "Responsable" }
              : null,
          subsidy.ministry_normalized
            ? { href: `/subvenciones?ministry=${encodeURIComponent(subsidy.ministry_normalized)}`, label: subsidy.ministry_normalized, meta: "Ministerio" }
            : null,
          subsidy.source_url
            ? { href: subsidy.source_url, label: "Convocatoria oficial", external: true }
            : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Subvención · BDNS {subsidy.bdns_id}
                {subsidy.cod_concesion ? ` · ${subsidy.cod_concesion}` : ""}
              </span>
            }
            title={titleText}
            description="Concesión pública enlazada a su beneficiario, órgano concedente y responsable."
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

            <InfoPanel title="Fuente">
              Base de Datos Nacional de Subvenciones (BDNS) · Intervención General de la Administración del Estado (IGAE).
              {subsidy.source_url && (
                <>
                  {" "}
                  <a href={subsidy.source_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    Ver convocatoria oficial →
                  </a>
                </>
              )}
            </InfoPanel>
          </>
        }
      >
        <StatGrid variant="flat" items={[{ label: "Importe", value: formatAmount(subsidy.importe) }]} />

        <RecordSection title="Datos de la concesión">
          <FieldList items={items} />
        </RecordSection>
      </RecordLayout>
    </div>
  )
}
