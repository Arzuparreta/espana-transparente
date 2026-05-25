import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { TerritoryFlag } from "@/components/domain/TerritoryFlag"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getAutonomicLanding } from "@/lib/data/multilevel"

export const revalidate = 3600

export const metadata = {
  title: "Gasto autonómico",
  description:
    "Subvenciones y contratos publicados con ámbito autonómico en la BDNS y la Plataforma de Contratación.",
}

function formatAmount(value: number) {
  if (!value) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M €`
  return `${Math.round(value).toLocaleString("es-ES")} €`
}

export default async function CcaaPage() {
  const { summary, territories, coverage } = await getAutonomicLanding()
  const hasData = summary.subsidyCount > 0 || summary.contractCount > 0
  const latestDate = [summary.subsidyLatestDate, summary.contractLatestDate]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)
  const visibleTerritories = territories.slice(0, 24)

  return (
    <div className="ui-page">
      <PageHeader
        title="Gasto autonómico"
        description="Drilldowns por comunidad autónoma basados en los campos territoriales que publican BDNS y PCSP. Cuando una fuente no publica territorio resoluble, el registro queda fuera del listado territorial y se cuenta aparte."
      />

      <SourceFootnote
        sourceLabel="BDNS · PCSP"
        sourceHref="https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias"
        latestRecordDate={latestDate ?? null}
        coverageLabel={`${territories.length.toLocaleString("es-ES")} territorios resueltos · ${summary.subsidyCount.toLocaleString("es-ES")} subvenciones · ${summary.contractCount.toLocaleString("es-ES")} contratos`}
      />

      <StatGrid
        items={[
          { label: "Territorios con drilldown", value: territories.length.toLocaleString("es-ES") },
          { label: "Subvenciones (AUTONOMICA)", value: summary.subsidyCount.toLocaleString("es-ES") },
          { label: "Contratos (autonómico)", value: summary.contractCount.toLocaleString("es-ES") },
        ]}
      />

      {!hasData ? (
        <EmptyState
          title="Sin registros autonómicos en la muestra"
          description={
            <>
              El cruce por nivel administrativo puede estar incompleto. Consulta el{" "}
              <ResponsiveLink href="/estado-datos" className="underline-offset-2 hover:underline">
                estado de los datos
              </ResponsiveLink>{" "}
              para ver la cobertura por pipeline.
            </>
          }
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Comunidades con registros resueltos
            </h2>
            {visibleTerritories.length === 0 ? (
              <EmptyState
                title="Sin territorio autonómico resoluble"
                description="Hay registros con nivel autonómico, pero las fuentes no publican un territorio reutilizable en los campos usados para construir la ruta."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleTerritories.map((territory) => (
                  <ResponsiveLink
                    key={territory.territoryKey}
                    href={`/ccaa/${encodeURIComponent(territory.territoryKey)}`}
                    className="flex gap-3 rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
                  >
                    <TerritoryFlag territoryName={territory.territoryName} className="shrink-0" />
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
                    {row.dataset === "subsidies"
                      ? "Subvenciones agrupadas por el campo nivel2 publicado por la BDNS."
                      : "Contratos agrupados por el campo region publicado por la Plataforma de Contratación."}
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
              href="/subvenciones?nivel=AUTONOMICA"
              className="block rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
            >
              <span className="font-medium">Subvenciones autonómicas</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                Filtro nivel AUTONOMICA en BDNS
              </span>
            </ResponsiveLink>
          </li>
          <li>
            <ResponsiveLink
              href="/contratos?level=autonomic"
              className="block rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
            >
              <span className="font-medium">Contratos autonómicos</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                Contratos con administration_level autonomic
              </span>
            </ResponsiveLink>
          </li>
        </ul>
      </section>
    </div>
  )
}
