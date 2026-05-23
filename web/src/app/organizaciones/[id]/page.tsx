import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getOrganizationPageData } from "@/lib/data"

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

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const { organization } = await getOrganizationPageData(id)
  return { title: organization?.name || "Organización" }
}

export default async function OrganizacionPage({ params }: PageProps) {
  const { id } = await params
  const { organization, contracts, beneficiarySubsidies, grantingSubsidies, revolvingDoorCases, euFunds, appointments, bormeOfficers } =
    await getOrganizationPageData(id)

  if (!organization) notFound()

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/organizaciones", label: "Organizaciones" }}
        current={organization.name}
        meta={organization.organization_type ?? undefined}
        fallbackHref="/organizaciones"
        fallbackLabel="Volver a Organizaciones"
        related={[
          organization.contract_count > 0
            ? { href: `/contratos?ministry=${encodeURIComponent(organization.name)}`, label: "Contratos asociados" }
            : null,
          organization.subsidy_beneficiary_count > 0
            ? { href: `/subvenciones?ministry=${encodeURIComponent(organization.name)}`, label: "Subvenciones asociadas" }
            : null,
          organization.source_url
            ? { href: organization.source_url, label: "Fuente base", external: true }
            : null,
        ]}
      />
      <PageHeader
        title={organization.name}
        description="Ficha de organización enlazada a contratos, subvenciones y movimientos público-privados detectados en la base."
      />

      <StatGrid
        items={[
          { label: "Contratos", value: organization.contract_count, hint: "Expedientes donde figura como órgano contratante o adjudicataria." },
          { label: "Subvenciones recibidas", value: organization.subsidy_beneficiary_count, hint: "Concesiones donde figura como beneficiaria." },
          { label: "Subvenciones concedidas", value: organization.subsidy_granting_count, hint: "Concesiones donde figura como órgano concedente." },
          { label: "Puertas giratorias", value: organization.revolving_door_count, hint: "Movimientos publicados asociados a esta organización." },
          { label: "Fondos europeos", value: organization.eu_fund_count, hint: "Beneficiario de fondos UE (Kohesio)." },
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

        {(appointments && appointments.length > 0 || bormeOfficers && bormeOfficers.length > 0) && (
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contratos vinculados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contracts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin contratos vinculados.</p>
            ) : (
              contracts.map((contract) => (
                <div key={contract.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/contratos/${contract.id}`} className="font-medium underline-offset-2 hover:underline">
                    {contract.title}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(contract.date)} · {formatAmount(contract.amount)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subvenciones recibidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {beneficiarySubsidies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin subvenciones recibidas enlazadas.</p>
            ) : (
              beneficiarySubsidies.map((subsidy) => (
                <div key={subsidy.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/subvenciones/${subsidy.id}`} className="font-medium underline-offset-2 hover:underline">
                    {subsidy.beneficiario || organization.name}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(subsidy.fecha_concesion)} · {formatAmount(subsidy.importe)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subvenciones concedidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {grantingSubsidies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin subvenciones concedidas enlazadas.</p>
            ) : (
              grantingSubsidies.map((subsidy) => (
                <div key={subsidy.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/subvenciones/${subsidy.id}`} className="font-medium underline-offset-2 hover:underline">
                    {subsidy.beneficiario || "Beneficiario sin nombre"}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(subsidy.fecha_concesion)} · {formatAmount(subsidy.importe)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Puertas giratorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {revolvingDoorCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos publicados.</p>
            ) : (
              revolvingDoorCases.map((entry) => (
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
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fondos europeos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {euFunds.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin fondos europeos registrados para esta organización.</p>
            ) : (
              euFunds.map((fund) => (
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
