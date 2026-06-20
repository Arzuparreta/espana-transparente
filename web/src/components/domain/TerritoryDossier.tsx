import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { TerritoryFlag } from "@/components/domain/TerritoryFlag"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { TerritoryDetailData, TerritoryScope } from "@/lib/data/multilevel"
import { formatEuroCompact } from "@/lib/format"

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type Copy = {
  description: string
  caveat: string
  subsidyVerticalHref: string
  subsidyVerticalLabel: string
  contractVerticalHref: string
  contractVerticalLabel: string
  emptySubsidies: string
  emptyContracts: string
  showFlag: boolean
}

const COPY: Record<TerritoryScope, Copy> = {
  autonomic: {
    description:
      "Agrupación territorial construida con el campo nivel2 de BDNS y el campo region de PCSP cuando el registro está clasificado como autonómico.",
    caveat:
      "Este drilldown no geocodifica nombres ni rellena huecos. Si un expediente no trae un territorio reutilizable en los campos públicos de origen, no entra en esta ruta y sigue visible solo en las verticales generales.",
    subsidyVerticalHref: "/subvenciones?nivel=AUTONOMICA",
    subsidyVerticalLabel: "Ver subvenciones autonómicas",
    contractVerticalHref: "/contratos?level=autonomic",
    contractVerticalLabel: "Ver contratos autonómicos",
    emptySubsidies: "La BDNS no publica registros autonómicos recientes reutilizables para este territorio.",
    emptyContracts: "La PCSP no publica contratos autonómicos recientes reutilizables para este territorio.",
    showFlag: true,
  },
  municipal: {
    description:
      "Agrupación territorial construida con el literal publicado en nivel2 para subvenciones locales y en region para contratos municipales.",
    caveat:
      "La ruta se monta sobre el literal territorial publicado por la fuente. Dos municipios con el mismo nombre pueden quedar mezclados si la BDNS o la PCSP no aportan provincia o código adicional en el mismo campo.",
    subsidyVerticalHref: "/subvenciones?nivel=LOCAL",
    subsidyVerticalLabel: "Ver subvenciones locales",
    contractVerticalHref: "/contratos?level=municipal",
    contractVerticalLabel: "Ver contratos municipales",
    emptySubsidies:
      "La BDNS no publica subvenciones locales recientes reutilizables para este municipio o literal territorial.",
    emptyContracts:
      "La PCSP no publica contratos municipales recientes reutilizables para este municipio o literal territorial.",
    showFlag: false,
  },
}

/**
 * Unified territorial detail page body. Replaces the former /ccaa/[x] and
 * /municipios/[x] page bodies (near-identical) with one scope-parameterized view.
 */
export function TerritoryDossier({
  scope,
  detail,
}: {
  scope: TerritoryScope
  detail: TerritoryDetailData
}) {
  const copy = COPY[scope]
  const { territory } = detail
  const latestDate = [territory.subsidyLatestDate, territory.contractLatestDate]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/territorio", label: "Tu territorio" }}
        current={territory.territoryName}
        meta="Tu territorio"
        fallbackHref="/territorio"
        fallbackLabel="Volver a Tu territorio"
        related={[
          territory.subsidyCount > 0
            ? { href: copy.subsidyVerticalHref, label: copy.subsidyVerticalLabel }
            : null,
          territory.contractCount > 0
            ? { href: copy.contractVerticalHref, label: copy.contractVerticalLabel }
            : null,
        ]}
      />

      <PageHeader
        title={territory.territoryName}
        description={copy.description}
        actions={copy.showFlag ? <TerritoryFlag territoryName={territory.territoryName} size="lg" /> : undefined}
      />

      <SourceFootnote
        sourceLabel="BDNS · PCSP"
        sourceHref="https://contrataciondelestado.es"
        latestRecordDate={latestDate ?? null}
        coverageLabel={`${territory.subsidyCount.toLocaleString("es-ES")} subvenciones · ${territory.contractCount.toLocaleString("es-ES")} contratos`}
      />

      <StatGrid
        items={[
          { label: "Subvenciones", value: territory.subsidyCount.toLocaleString("es-ES") },
          { label: "Importe subvenciones", value: formatEuroCompact(territory.subsidyAmount) },
          { label: "Contratos", value: territory.contractCount.toLocaleString("es-ES") },
          { label: "Importe contratos", value: formatEuroCompact(territory.contractAmount) },
        ]}
      />

      <p className="text-xs leading-5 text-muted-foreground">{copy.caveat}</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subvenciones recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.recentSubsidies.length === 0 ? (
              <EmptyState title="Sin subvenciones" description={copy.emptySubsidies} />
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
                    {subsidy.grantingBody || territory.territoryName}
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
              <EmptyState title="Sin contratos" description={copy.emptyContracts} />
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
                    {contract.awardingBody || territory.territoryName}
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
