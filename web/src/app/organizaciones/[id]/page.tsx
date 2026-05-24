import { Suspense } from "react"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { EntityTrail, EntityTrailSkeleton } from "@/components/domain/EntityTrail"
import { getOrganizationPageData, JUDICIAL_STATUS_LABEL } from "@/lib/data"
import type { JudicialStatus } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ id: string }>
}

function formatAmount(value: number | null | undefined) {
  if (value == null) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M €`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K €`
  return `${Math.round(value).toLocaleString("es-ES")} €`
}

function formatDate(value: string | null | undefined) {
  if (!value) return null
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
  const revolvingDoorCount = summary?.revolving_door_count ?? organization.revolving_door_count
  const judicialCaseCount = summary?.judicial_case_count ?? organization.judicial_case_count
  const bormeOfficerCount = summary?.borme_officer_count ?? bormeOfficers.length
  const appointmentCount = summary?.institutional_appointment_count ?? appointments.length
  const lobbyingGroupCount = summary?.lobbying_group_count ?? lobbyingLinks.length
  const hasGovernanceData = appointments.length > 0 || bormeOfficers.length > 0

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/organizaciones", label: "Organizaciones" }}
        current={organization.name}
        meta={organization.organization_type ?? undefined}
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
      <PageHeader
        title={organization.name}
        description="Ficha de organización enlazada a contratos, subvenciones, fondos europeos, cargos publicados y vínculos revisados."
      />

      <StatGrid
        items={[
          { label: "Contratos", value: formatAmount(summary?.contract_total ?? 0), hint: `${contractCount.toLocaleString("es-ES")} expedientes como órgano contratante o adjudicataria.`, valueClassName: "text-2xl" },
          { label: "Subvenciones recibidas", value: formatAmount(summary?.subsidy_received_total ?? 0), hint: `${subsidyReceivedCount.toLocaleString("es-ES")} concesiones como beneficiaria.`, valueClassName: "text-2xl" },
          { label: "Subvenciones concedidas", value: formatAmount(summary?.subsidy_granted_total ?? 0), hint: `${subsidyGrantedCount.toLocaleString("es-ES")} concesiones como órgano concedente.`, valueClassName: "text-2xl" },
          { label: "Fondos UE", value: formatAmount(summary?.eu_fund_total ?? 0), hint: `${euFundCount.toLocaleString("es-ES")} registros Kohesio vinculados.`, valueClassName: "text-2xl" },
        ]}
      />

      <StatGrid
        items={[
          { label: "Cargos SEPI", value: appointmentCount, hint: "Nombramientos publicados para filiales SEPI." },
          { label: "BORME", value: bormeOfficerCount, hint: "Administradores vigentes en el Registro Mercantil." },
          { label: "Puertas giratorias", value: revolvingDoorCount, hint: "Movimientos publicados asociados a esta organización." },
          { label: "Procesos judiciales", value: judicialCaseCount, hint: "Vínculos revisados con procedimientos publicados." },
          { label: "Grupos de interés", value: lobbyingGroupCount, hint: "Vínculos revisados con el registro CNMC." },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Tipo:</span> {organization.organization_type || "—"}</div>
            <div><span className="text-muted-foreground">Sector:</span> {organization.sector || "—"}</div>
            <div><span className="text-muted-foreground">País:</span> {organization.country || "—"}</div>
            {organization.source_url ? (
              <a
                href={organization.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm underline-offset-4 hover:underline"
              >
                Fuente base
              </a>
            ) : null}
          </CardContent>
        </Card>

        {hasGovernanceData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {appointments && appointments.length > 0 ? "Consejo de administración" : "Administradores (BORME)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {appointments && appointments.length > 0 && appointments.map((a: Record<string, unknown>) => (
                <div key={`${a.institution}-${a.person_name}`} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <div className="font-medium">{a.person_name as string}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.position_title as string}
                    {a.political_party ? ` · ${a.political_party}` : ""}
                  </div>
                </div>
              ))}
              {bormeOfficers && bormeOfficers.length > 0 && (
                <>
                  {appointments && appointments.length > 0 && bormeOfficers.length > 0 && (
                    <div className="text-xs text-muted-foreground border-t border-border pt-2">
                      También en el Registro Mercantil (BORME)
                    </div>
                  )}
                  {bormeOfficers.map((o: Record<string, unknown>) => (
                    <div key={`borme-${o.person_name}-${o.role}`} className="border-l-2 border-muted/50 py-1 pl-3 text-sm">
                      <div className="font-medium">{o.person_name as string}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.role as string}
                        {o.since ? ` · desde ${(o.since as string).slice(0, 7)}` : ""}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {contracts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contratos vinculados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contracts.map((contract) => (
                <div key={contract.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/contratos/${contract.id}`} className="font-medium underline-offset-2 hover:underline">
                    {contract.title}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(contract.date)} · {formatAmount(contract.amount)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {beneficiarySubsidies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subvenciones recibidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {beneficiarySubsidies.map((subsidy) => (
                <div key={subsidy.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/subvenciones/${subsidy.id}`} className="font-medium underline-offset-2 hover:underline">
                    {subsidy.beneficiario || organization.name}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(subsidy.fecha_concesion)} · {formatAmount(subsidy.importe)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {grantingSubsidies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subvenciones concedidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {grantingSubsidies.map((subsidy) => (
                <div key={subsidy.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/subvenciones/${subsidy.id}`} className="font-medium underline-offset-2 hover:underline">
                    {subsidy.beneficiario || "Beneficiario sin nombre"}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(subsidy.fecha_concesion)} · {formatAmount(subsidy.importe)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {revolvingDoorCases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Puertas giratorias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {revolvingDoorCases.map((entry) => (
                <div key={entry.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <div className="font-medium">
                    {entry.person_id ? (
                      <ResponsiveLink
                        href={`/diputados/${entry.person_id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {entry.person_name}
                      </ResponsiveLink>
                    ) : (
                      entry.person_name
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.public_role} → {entry.private_role}
                    {entry.private_start_date ? ` · ${formatDate(entry.private_start_date)}` : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {euFunds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fondos europeos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {euFunds.map((fund) => (
                <div key={fund.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink
                    href={`/fondos-ue/${fund.id.split("/").pop()}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {fund.label}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {fund.number_projects != null ? `${fund.number_projects} proyectos` : "—"}
                    {" · "}
                    {formatAmount(fund.eu_budget)}
                    {fund.cofinancing_rate != null ? ` · cofin. ${fund.cofinancing_rate}%` : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {judicialLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Procesos judiciales relacionados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {judicialLinks.map((link) => (
                <div key={link.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/corrupcion/${link.case_id}`} className="font-medium underline-offset-2 hover:underline">
                    {link.case_title}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {JUDICIAL_STATUS_LABEL[link.procedural_status as JudicialStatus]}
                    {link.offence_category ? ` · ${link.offence_category}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">{link.link_reason}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {lobbyingLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Grupos de interés relacionados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lobbyingLinks.map((link: Record<string, unknown>) => {
                const group = getLobbyingGroup(link)
                if (!group) return null
                return (
                  <div key={link.id as string} className="border-l-2 border-muted py-1 pl-3 text-sm">
                    <a
                      href={group.source_url as string}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {group.name as string}
                    </a>
                    <div className="text-xs text-muted-foreground">
                      {[group.category, group.subcategory].filter(Boolean).join(" · ") || "Registro de Grupos de Interés CNMC"}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <Suspense fallback={<EntityTrailSkeleton />}>
        <EntityTrail entityType="organization" entityId={id} />
      </Suspense>
    </div>
  )
}
