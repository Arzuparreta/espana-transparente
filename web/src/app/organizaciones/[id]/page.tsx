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
  const { organization, contracts, beneficiarySubsidies, grantingSubsidies, revolvingDoorCases } =
    await getOrganizationPageData(id)

  if (!organization) notFound()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
      </div>
    </div>
  )
}
