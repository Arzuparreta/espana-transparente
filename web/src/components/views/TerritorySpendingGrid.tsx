import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/domain/EmptyState"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { TerritoryFlag } from "@/components/domain/TerritoryFlag"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getTerritoryLanding, type TerritoryScope } from "@/lib/data/multilevel"
import { territoryDetailHref } from "@/lib/territory-routes"

function formatAmount(value: number) {
  if (!value) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M €`
  return `${Math.round(value).toLocaleString("es-ES")} €`
}

type Copy = {
  sourceHref: string
  subsidyStat: string
  contractStat: string
  emptyTitle: string
  emptyDescription: React.ReactNode
  sectionHeading: string
  unresolvedTitle: string
  unresolvedDescription: string
  subsidyCoverageNote: string
  contractCoverageNote: string
  subsidyVerticalHref: string
  subsidyVerticalLabel: string
  subsidyVerticalHint: string
  contractVerticalHref: string
  contractVerticalLabel: string
  contractVerticalHint: string
  showFlag: boolean
}

const COPY: Record<TerritoryScope, Copy> = {
  autonomic: {
    sourceHref: "https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias",
    subsidyStat: "Subvenciones (AUTONOMICA)",
    contractStat: "Contratos (autonómico)",
    emptyTitle: "Sin registros autonómicos en la muestra",
    emptyDescription: (
      <>
        El cruce por nivel administrativo puede estar incompleto. Consulta el{" "}
        <ResponsiveLink href="/estado-datos" className="underline-offset-2 hover:underline">
          estado de los datos
        </ResponsiveLink>{" "}
        para ver la cobertura por pipeline.
      </>
    ),
    sectionHeading: "Comunidades con registros resueltos",
    unresolvedTitle: "Sin territorio autonómico resoluble",
    unresolvedDescription:
      "Hay registros con nivel autonómico, pero las fuentes no publican un territorio reutilizable en los campos usados para construir la ruta.",
    subsidyCoverageNote: "Subvenciones agrupadas por el campo nivel2 publicado por la BDNS.",
    contractCoverageNote: "Contratos agrupados por el campo region publicado por la Plataforma de Contratación.",
    subsidyVerticalHref: "/subvenciones?nivel=AUTONOMICA",
    subsidyVerticalLabel: "Subvenciones autonómicas",
    subsidyVerticalHint: "Filtro nivel AUTONOMICA en BDNS",
    contractVerticalHref: "/contratos?level=autonomic",
    contractVerticalLabel: "Contratos autonómicos",
    contractVerticalHint: "Contratos con administration_level autonomic",
    showFlag: true,
  },
  municipal: {
    sourceHref: "https://contrataciondelestado.es",
    subsidyStat: "Subvenciones (LOCAL)",
    contractStat: "Contratos (municipal)",
    emptyTitle: "Sin registros locales en la muestra",
    emptyDescription: (
      <>
        La clasificación municipal depende de los campos territoriales publicados por cada fuente.
        Consulta el{" "}
        <ResponsiveLink href="/estado-datos" className="underline-offset-2 hover:underline">
          estado de los datos
        </ResponsiveLink>
        .
      </>
    ),
    sectionHeading: "Municipios y entidades locales con registros resueltos",
    unresolvedTitle: "Sin territorio local resoluble",
    unresolvedDescription:
      "Hay registros con nivel local, pero no exponen un nombre territorial reutilizable para construir una ruta pública por municipio.",
    subsidyCoverageNote: "Subvenciones agrupadas por el literal territorial publicado en nivel2.",
    contractCoverageNote:
      "Contratos agrupados por el literal publicado en region. Nombres idénticos pueden mezclar entidades si la fuente no aporta más detalle.",
    subsidyVerticalHref: "/subvenciones?nivel=LOCAL",
    subsidyVerticalLabel: "Subvenciones locales",
    subsidyVerticalHint: "Filtro nivel LOCAL en BDNS",
    contractVerticalHref: "/contratos?level=municipal",
    contractVerticalLabel: "Contratos municipales",
    contractVerticalHint: "Contratos con administration_level municipal",
    showFlag: false,
  },
}

/**
 * Unified territorial spending grid. Replaces the former AutonomicSpendingView
 * and MunicipalSpendingView (near-identical) with one scope-parameterized view.
 */
export async function TerritorySpendingGrid({ scope }: { scope: TerritoryScope }) {
  const copy = COPY[scope]
  const { summary, territories, coverage } = await getTerritoryLanding(scope)
  const hasData = summary.subsidyCount > 0 || summary.contractCount > 0
  const latestDate = [summary.subsidyLatestDate, summary.contractLatestDate]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)
  const visibleTerritories = territories.slice(0, 24)

  return (
    <div className="space-y-6 sm:space-y-8">
      <SourceFootnote
        sourceLabel="BDNS · PCSP"
        sourceHref={copy.sourceHref}
        latestRecordDate={latestDate ?? null}
        coverageLabel={`${territories.length.toLocaleString("es-ES")} territorios resueltos · ${summary.subsidyCount.toLocaleString("es-ES")} subvenciones · ${summary.contractCount.toLocaleString("es-ES")} contratos`}
      />

      <StatGrid
        items={[
          { label: "Territorios con drilldown", value: territories.length.toLocaleString("es-ES") },
          { label: copy.subsidyStat, value: summary.subsidyCount.toLocaleString("es-ES") },
          { label: copy.contractStat, value: summary.contractCount.toLocaleString("es-ES") },
        ]}
      />

      {!hasData ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {copy.sectionHeading}
            </h2>
            {visibleTerritories.length === 0 ? (
              <EmptyState title={copy.unresolvedTitle} description={copy.unresolvedDescription} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleTerritories.map((territory) => (
                  <ResponsiveLink
                    key={territory.territoryKey}
                    href={territoryDetailHref(scope, territory.territoryKey)}
                    className="flex gap-3 rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
                  >
                    {copy.showFlag ? (
                      <TerritoryFlag territoryName={territory.territoryName} className="shrink-0" />
                    ) : null}
                    <div className="min-w-0">
                      <div className="font-medium">{territory.territoryName}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {territory.subsidyCount.toLocaleString("es-ES")} subvenciones ·{" "}
                        {territory.contractCount.toLocaleString("es-ES")} contratos
                      </div>
                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        {formatAmount(territory.subsidyAmount + territory.contractAmount)}
                      </div>
                    </div>
                  </ResponsiveLink>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {coverage.map((row) => (
              <Card key={row.dataset}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {row.dataset === "subsidies" ? "Cobertura BDNS" : "Cobertura PCSP"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Con territorio visible:</span>{" "}
                    <span className="font-mono">{row.resolvedCount.toLocaleString("es-ES")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sin territorio reutilizable:</span>{" "}
                    <span className="font-mono">{row.unresolvedCount.toLocaleString("es-ES")}</span>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {row.dataset === "subsidies" ? copy.subsidyCoverageNote : copy.contractCoverageNote}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Explorar por vertical
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <ResponsiveLink
              href={copy.subsidyVerticalHref}
              className="block rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
            >
              <span className="font-medium">{copy.subsidyVerticalLabel}</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                {copy.subsidyVerticalHint}
              </span>
            </ResponsiveLink>
          </li>
          <li>
            <ResponsiveLink
              href={copy.contractVerticalHref}
              className="block rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
            >
              <span className="font-medium">{copy.contractVerticalLabel}</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                {copy.contractVerticalHint}
              </span>
            </ResponsiveLink>
          </li>
        </ul>
      </section>
    </div>
  )
}
