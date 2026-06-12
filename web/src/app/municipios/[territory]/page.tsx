import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  getMunicipalTerritoryDetail,
} from "@/lib/data/multilevel"
import { formatEuroCompact } from "@/lib/format"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ territory: string }>
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export async function generateMetadata({ params }: PageProps) {
  const { territory } = await params
  const detail = await getMunicipalTerritoryDetail(decodeURIComponent(territory))
  return { title: detail ? `${detail.territory.territoryName} · Gasto municipal` : "Gasto municipal" }
}

export default async function MunicipioTerritoryPage({ params }: PageProps) {
  const { territory } = await params
  const detail = await getMunicipalTerritoryDetail(decodeURIComponent(territory))

  if (!detail) notFound()

  const latestDate = [detail.territory.subsidyLatestDate, detail.territory.contractLatestDate]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/territorio?view=municipal", label: "Gasto municipal" }}
        current={detail.territory.territoryName}
        meta="Gasto municipal"
        fallbackHref="/territorio?view=municipal"
        fallbackLabel="Volver a Gasto municipal"
        related={[
          detail.territory.subsidyCount > 0
            ? { href: "/subvenciones?nivel=LOCAL", label: "Ver subvenciones locales" }
            : null,
          detail.territory.contractCount > 0
            ? { href: "/contratos?level=municipal", label: "Ver contratos municipales" }
            : null,
        ]}
      />

      <PageHeader
        title={detail.territory.territoryName}
        description="Agrupación territorial construida con el literal publicado en nivel2 para subvenciones locales y en region para contratos municipales."
      />

      <SourceFootnote
        sourceLabel="BDNS · PCSP"
        sourceHref="https://contrataciondelestado.es"
        latestRecordDate={latestDate ?? null}
        coverageLabel={`${detail.territory.subsidyCount.toLocaleString("es-ES")} subvenciones · ${detail.territory.contractCount.toLocaleString("es-ES")} contratos`}
      />

      <StatGrid
        items={[
          { label: "Subvenciones", value: detail.territory.subsidyCount.toLocaleString("es-ES") },
          { label: "Importe subvenciones", value: formatEuroCompact(detail.territory.subsidyAmount) },
          { label: "Contratos", value: detail.territory.contractCount.toLocaleString("es-ES") },
          { label: "Importe contratos", value: formatEuroCompact(detail.territory.contractAmount) },
        ]}
      />

      <p className="text-xs leading-5 text-muted-foreground">
        La ruta se monta sobre el literal territorial publicado por la fuente. Dos municipios con
        el mismo nombre pueden quedar mezclados si la BDNS o la PCSP no aportan provincia o código
        adicional en el mismo campo.
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subvenciones recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.recentSubsidies.length === 0 ? (
              <EmptyState
                title="Sin subvenciones"
                description="La BDNS no publica subvenciones locales recientes reutilizables para este municipio o literal territorial."
              />
            ) : (
              detail.recentSubsidies.map((subsidy) => (
                <div key={subsidy.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/subvenciones/${subsidy.id}`} className="font-medium underline-offset-2 hover:underline">
                    {subsidy.convocatoria || subsidy.beneficiario || "Subvención"}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(subsidy.fechaConcesion)} · {formatEuroCompact(subsidy.importe)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {subsidy.grantingBody || detail.territory.territoryName}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contratos recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.recentContracts.length === 0 ? (
              <EmptyState
                title="Sin contratos"
                description="La PCSP no publica contratos municipales recientes reutilizables para este municipio o literal territorial."
              />
            ) : (
              detail.recentContracts.map((contract) => (
                <div key={contract.id} className="border-l-2 border-muted py-1 pl-3 text-sm">
                  <ResponsiveLink href={`/contratos/${contract.id}`} className="font-medium underline-offset-2 hover:underline">
                    {contract.title || "Contrato sin título"}
                  </ResponsiveLink>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(contract.date)} · {formatEuroCompact(contract.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contract.awardingBody || detail.territory.territoryName}
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
