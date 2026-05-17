import { EmptyState } from "@/components/domain/EmptyState"
import { EntityLink } from "@/components/domain/EntityLink"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { PAGE_SIZE, getOrganizationsList, parsePage } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export const metadata = { title: "Organizaciones" }

export default async function OrganizacionesPage({ searchParams }: PageProps) {
  const { page: pageParam } = await searchParams
  const page = parsePage(pageParam)
  const { organizations, total } = await getOrganizationsList(page)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.organizations))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Organizaciones"
        description={`Empresas, fundaciones y organismos mencionados en contratos, subvenciones o nombramientos. Un catálogo de ${total.toLocaleString("es-ES")} entidades.`}
      />

      {organizations.length === 0 ? (
        <EmptyState
          title="Sin organizaciones"
          description="Aún no hay entidades registradas en la base."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Organización</th>
                <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Contratos</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Subvenciones recibidas</th>
                <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Puertas giratorias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {organizations.map((org) => (
                <tr key={org.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <EntityLink
                      kind="organization"
                      id={org.id}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {org.name}
                    </EntityLink>
                    {org.sector && (
                      <div className="text-xs text-muted-foreground">{org.sector}</div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {org.organization_type ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {org.contract_count > 0 ? org.contract_count.toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                    {org.subsidy_beneficiary_count > 0
                      ? org.subsidy_beneficiary_count.toLocaleString("es-ES")
                      : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground lg:table-cell">
                    {org.revolving_door_count > 0 ? org.revolving_door_count : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(p) => `?page=${p}`}
      />
    </div>
  )
}
