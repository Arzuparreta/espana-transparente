import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import { FieldList } from "@/components/domain/FieldList"
import { RecordTable } from "@/components/domain/RecordTable"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { EntityTrail, EntityTrailSkeleton } from "@/components/domain/EntityTrail"
import { getOrganizationPageData, JUDICIAL_STATUS_LABEL } from "@/lib/data"
import type { JudicialStatus } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

const LINK = "underline-offset-2 hover:underline"

const ORG_TYPE_LABELS: Record<string, string> = {
  public_body: "Organismo público",
  autonomous_body: "Organismo autónomo",
  company: "Empresa",
  state_company: "Empresa pública",
  state_owned: "Empresa pública",
  ministry: "Ministerio",
  foundation: "Fundación",
  association: "Asociación",
  university: "Universidad",
  other: "Otra",
}

function formatOrgType(value?: string | null) {
  if (!value) return null
  return ORG_TYPE_LABELS[value] ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

function formatAmount(value: number | null | undefined) {
  if (value == null) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M €`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K €`
  return `${Math.round(value).toLocaleString("es-ES")} €`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getLobbyingGroup(link: Record<string, unknown>) {
  const group = link.lobbying_groups
  if (Array.isArray(group)) return (group[0] as Record<string, unknown> | undefined) ?? null
  return (group as Record<string, unknown> | null) ?? null
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { organization } = await getOrganizationPageData(id)
  return { title: organization?.name || "Organización" }
}

export default async function OrganizacionPage({ params }: PageProps) {
  const { id } = await params
  const { organization, entitySummary, contracts, beneficiarySubsidies, grantingSubsidies, revolvingDoorCases, euFunds, appointments, bormeOfficers, judicialLinks, lobbyingLinks } =
    await getOrganizationPageData(id)

  if (!organization) notFound()

  const summary = entitySummary
  const contractCount = summary?.contract_count ?? organization.contract_count
  const subsidyReceivedCount = summary?.subsidy_received_count ?? organization.subsidy_beneficiary_count
  const subsidyGrantedCount = summary?.subsidy_granted_count ?? organization.subsidy_granting_count
  const euFundCount = summary?.eu_fund_count ?? organization.eu_fund_count
  const orgTypeLabel = formatOrgType(organization.organization_type)

  const governance = [
    ...appointments.map((a: Record<string, unknown>) => ({
      key: `appt-${a.institution}-${a.person_name}`,
      source: "SEPI",
      name: a.person_name as string,
      role: [a.position_title, a.political_party].filter(Boolean).join(" · "),
    })),
    ...bormeOfficers.map((o: Record<string, unknown>) => ({
      key: `borme-${o.person_name}-${o.role}`,
      source: "BORME",
      name: o.person_name as string,
      role: [o.role, o.since ? `desde ${(o.since as string).slice(0, 7)}` : null].filter(Boolean).join(" · "),
    })),
  ]

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/organizaciones", label: "Organizaciones" }}
        current={organization.name}
        meta={orgTypeLabel ?? undefined}
        fallbackHref="/organizaciones"
        fallbackLabel="Volver a Organizaciones"
        related={[
          contractCount > 0
            ? { href: `/contratos?ministry=${encodeURIComponent(organization.name)}`, label: "Contratos asociados" }
            : null,
          subsidyReceivedCount > 0
            ? { href: `/subvenciones?ministry=${encodeURIComponent(organization.name)}`, label: "Subvenciones asociadas" }
            : null,
          organization.source_url
            ? { href: organization.source_url, label: "Fuente base", external: true }
            : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Organización{orgTypeLabel ? ` · ${orgTypeLabel}` : ""}
              </span>
            }
            title={organization.name}
            description="Ficha enlazada a contratos, subvenciones, fondos europeos, cargos publicados y vínculos revisados."
          />
        }
        aside={
          <Suspense fallback={<EntityTrailSkeleton />}>
            <EntityTrail entityType="organization" entityId={id} />
          </Suspense>
        }
      >
        <StatGrid
          variant="flat"
          items={[
            { label: "Contratos", value: formatAmount(summary?.contract_total ?? 0), hint: `${contractCount.toLocaleString("es-ES")} expedientes como órgano contratante o adjudicataria.`, valueClassName: "text-2xl" },
            { label: "Subvenciones recibidas", value: formatAmount(summary?.subsidy_received_total ?? 0), hint: `${subsidyReceivedCount.toLocaleString("es-ES")} concesiones como beneficiaria.`, valueClassName: "text-2xl" },
            { label: "Subvenciones concedidas", value: formatAmount(summary?.subsidy_granted_total ?? 0), hint: `${subsidyGrantedCount.toLocaleString("es-ES")} concesiones como órgano concedente.`, valueClassName: "text-2xl" },
            { label: "Fondos UE", value: formatAmount(summary?.eu_fund_total ?? 0), hint: `${euFundCount.toLocaleString("es-ES")} registros Kohesio vinculados.`, valueClassName: "text-2xl" },
          ]}
        />

        <RecordSection title="Perfil">
          <FieldList
            items={[
              { label: "Tipo", value: orgTypeLabel || "—" },
              { label: "Sector", value: organization.sector || "—" },
              { label: "País", value: organization.country || "—" },
              organization.source_url
                ? {
                    label: "Fuente base",
                    value: (
                      <a href={organization.source_url} target="_blank" rel="noreferrer" className={LINK}>
                        Ver registro oficial ↗
                      </a>
                    ),
                  }
                : { label: "Fuente base", value: "—" },
            ]}
          />
        </RecordSection>

        {governance.length > 0 ? (
          <RecordSection
            title={appointments.length > 0 ? "Consejo de administración" : "Administradores"}
            count={governance.length}
          >
            <RecordTable
              caption="Personas con cargo en esta organización"
              rows={governance}
              keyFor={(row) => row.key}
              columns={[
                { header: "Persona", primary: true, cell: (row) => row.name },
                { header: "Cargo", cell: (row) => row.role || "—" },
                { header: "Fuente", cell: (row) => row.source },
              ]}
            />
          </RecordSection>
        ) : null}

        {contracts.length > 0 ? (
          <RecordSection title="Contratos vinculados" count={contracts.length}>
            <RecordTable
              caption="Contratos vinculados a la organización"
              rows={contracts}
              keyFor={(row) => row.id}
              columns={[
                {
                  header: "Expediente",
                  primary: true,
                  cell: (row) => (
                    <ResponsiveLink href={`/contratos/${row.id}`} className={LINK}>
                      {row.title}
                    </ResponsiveLink>
                  ),
                },
                { header: "Fecha", numeric: true, cell: (row) => formatDate(row.date) },
                { header: "Importe", numeric: true, cell: (row) => formatAmount(row.amount) },
              ]}
            />
          </RecordSection>
        ) : null}

        {beneficiarySubsidies.length > 0 ? (
          <RecordSection title="Subvenciones recibidas" count={beneficiarySubsidies.length}>
            <RecordTable
              caption="Subvenciones recibidas por la organización"
              rows={beneficiarySubsidies}
              keyFor={(row) => row.id}
              columns={[
                {
                  header: "Beneficiaria",
                  primary: true,
                  cell: (row) => (
                    <ResponsiveLink href={`/subvenciones/${row.id}`} className={LINK}>
                      {row.beneficiario || organization.name}
                    </ResponsiveLink>
                  ),
                },
                { header: "Fecha", numeric: true, cell: (row) => formatDate(row.fecha_concesion) },
                { header: "Importe", numeric: true, cell: (row) => formatAmount(row.importe) },
              ]}
            />
          </RecordSection>
        ) : null}

        {grantingSubsidies.length > 0 ? (
          <RecordSection title="Subvenciones concedidas" count={grantingSubsidies.length}>
            <RecordTable
              caption="Subvenciones concedidas por la organización"
              rows={grantingSubsidies}
              keyFor={(row) => row.id}
              columns={[
                {
                  header: "Beneficiario",
                  primary: true,
                  cell: (row) => (
                    <ResponsiveLink href={`/subvenciones/${row.id}`} className={LINK}>
                      {row.beneficiario || "Beneficiario sin nombre"}
                    </ResponsiveLink>
                  ),
                },
                { header: "Fecha", numeric: true, cell: (row) => formatDate(row.fecha_concesion) },
                { header: "Importe", numeric: true, cell: (row) => formatAmount(row.importe) },
              ]}
            />
          </RecordSection>
        ) : null}

        {revolvingDoorCases.length > 0 ? (
          <RecordSection title="Puertas giratorias" count={revolvingDoorCases.length}>
            <RecordTable
              caption="Movimientos de puertas giratorias asociados"
              rows={revolvingDoorCases}
              keyFor={(row) => row.id}
              columns={[
                {
                  header: "Persona",
                  primary: true,
                  cell: (row) =>
                    row.person_id ? (
                      <ResponsiveLink href={`/diputados/${row.person_id}`} className={LINK}>
                        {row.person_name}
                      </ResponsiveLink>
                    ) : (
                      row.person_name
                    ),
                },
                { header: "Movimiento", cell: (row) => `${row.public_role} → ${row.private_role}` },
                { header: "Fecha", numeric: true, cell: (row) => formatDate(row.private_start_date) },
              ]}
            />
          </RecordSection>
        ) : null}

        {euFunds.length > 0 ? (
          <RecordSection title="Fondos europeos" count={euFunds.length}>
            <RecordTable
              caption="Fondos europeos vinculados"
              rows={euFunds}
              keyFor={(row) => row.id}
              columns={[
                {
                  header: "Programa",
                  primary: true,
                  cell: (row) => (
                    <ResponsiveLink href={`/fondos-ue/${row.id.split("/").pop()}`} className={LINK}>
                      {row.label}
                    </ResponsiveLink>
                  ),
                },
                { header: "Proyectos", numeric: true, cell: (row) => (row.number_projects != null ? row.number_projects.toLocaleString("es-ES") : "—") },
                { header: "Presupuesto UE", numeric: true, cell: (row) => formatAmount(row.eu_budget) },
              ]}
            />
          </RecordSection>
        ) : null}

        {judicialLinks.length > 0 ? (
          <RecordSection title="Procesos judiciales relacionados" count={judicialLinks.length}>
            <RecordTable
              caption="Procesos judiciales relacionados"
              rows={judicialLinks}
              keyFor={(row) => row.id}
              columns={[
                {
                  header: "Caso",
                  primary: true,
                  cell: (row) => (
                    <ResponsiveLink href={`/corrupcion/${row.case_id}`} className={LINK}>
                      {row.case_title}
                    </ResponsiveLink>
                  ),
                },
                { header: "Estado", cell: (row) => JUDICIAL_STATUS_LABEL[row.procedural_status as JudicialStatus] },
                { header: "Vínculo", hideOnMobile: true, cell: (row) => row.link_reason },
              ]}
            />
          </RecordSection>
        ) : null}

        {lobbyingLinks.length > 0 ? (
          <RecordSection title="Grupos de interés relacionados" count={lobbyingLinks.length}>
            <RecordTable
              caption="Grupos de interés relacionados"
              rows={lobbyingLinks as Record<string, unknown>[]}
              keyFor={(row) => row.id as string}
              columns={[
                {
                  header: "Grupo",
                  primary: true,
                  cell: (row) => {
                    const group = getLobbyingGroup(row)
                    if (!group) return "—"
                    return (
                      <a href={group.source_url as string} target="_blank" rel="noreferrer" className={LINK}>
                        {group.name as string}
                      </a>
                    )
                  },
                },
                {
                  header: "Categoría",
                  cell: (row) => {
                    const group = getLobbyingGroup(row)
                    if (!group) return "—"
                    return [group.category, group.subcategory].filter(Boolean).join(" · ") || "Registro CNMC"
                  },
                },
              ]}
            />
          </RecordSection>
        ) : null}
      </RecordLayout>
    </div>
  )
}
