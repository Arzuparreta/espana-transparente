import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { TerritoryFlag } from "@/components/domain/TerritoryFlag"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { TerritoryDetailData, TerritoryEnrichment, TerritoryScope } from "@/lib/data/multilevel"
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
  enrichment,
}: {
  scope: TerritoryScope
  detail: TerritoryDetailData
  enrichment?: TerritoryEnrichment | null
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

      {enrichment ? (
        <section className="space-y-4 border-t border-border pt-6">
          <div className="space-y-1">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              ¿A dónde llega el dinero?
            </h2>
            <p className="text-sm text-muted-foreground">
              Contratos y subvenciones cuyo receptor (la empresa o entidad que cobra) tiene su sede
              en {territory.territoryName}. Cobertura parcial: la ubicación se resuelve por CIF y por
              el nombre del organismo, no para todos los registros.
            </p>
          </div>

          <StatGrid
            items={[
              {
                label: "Contratos que llegan aquí",
                value: enrichment.moneyIn.contractCount.toLocaleString("es-ES"),
                hint: formatEuroCompact(enrichment.moneyIn.contractAmount),
              },
              {
                label: "Subvenciones que llegan aquí",
                value: enrichment.moneyIn.subsidyCount.toLocaleString("es-ES"),
                hint: formatEuroCompact(enrichment.moneyIn.subsidyAmount),
              },
              {
                label: "Empresas y entidades con sede",
                value: enrichment.locatedOrgCount.toLocaleString("es-ES"),
                hint: enrichment.euFundCount > 0
                  ? `${enrichment.euFundCount.toLocaleString("es-ES")} con fondos UE`
                  : undefined,
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Empresas y entidades con sede aquí</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enrichment.companies.length === 0 ? (
                  <EmptyState
                    title="Sin empresas localizadas"
                    description="Ningún receptor con sede resoluble en este territorio ha recibido fondos en la muestra."
                  />
                ) : (
                  enrichment.companies.map((company) => (
                    <div key={company.id} className="flex items-baseline justify-between gap-3 border-l-2 border-muted py-1 pl-3 text-sm">
                      <ResponsiveLink
                        href={`/organizaciones/${company.id}`}
                        className="min-w-0 truncate font-medium underline-offset-2 hover:underline"
                      >
                        {company.name}
                      </ResponsiveLink>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatEuroCompact(company.receivedTotal)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {enrichment.representatives.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tus representantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {enrichment.representatives.map((rep) => (
                    <div key={rep.id} className="flex items-baseline justify-between gap-3 border-l-2 border-muted py-1 pl-3 text-sm">
                      <ResponsiveLink
                        href={`/diputados/${rep.id}`}
                        className="min-w-0 truncate font-medium underline-offset-2 hover:underline"
                      >
                        {rep.name}
                      </ResponsiveLink>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {rep.party ?? rep.constituency}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <SourceFootnote
            sourceLabel="PCSP · BDNS · Kohesio · Registro Mercantil (CIF)"
            sourceHref="https://contrataciondelestado.es"
            coverageLabel={`${enrichment.locatedOrgCount.toLocaleString("es-ES")} entidades con sede resuelta · geolocalización parcial`}
          />
        </section>
      ) : null}
    </div>
  )
}
