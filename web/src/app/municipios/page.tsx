import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getMunicipalLanding } from "@/lib/data/multilevel"

export const revalidate = 3600

export const metadata = {
  title: "Gasto municipal",
  description:
    "Subvenciones y contratos publicados con ámbito local en la BDNS y la Plataforma de Contratación.",
}

function formatAmount(value: number) {
  if (!value) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M €`
  return `${Math.round(value).toLocaleString("es-ES")} €`
}

export default async function MunicipiosPage() {
  const { summary, territories, coverage } = await getMunicipalLanding()
  const hasData = summary.subsidyCount > 0 || summary.contractCount > 0
  const latestDate = [summary.subsidyLatestDate, summary.contractLatestDate]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)
  const visibleTerritories = territories.slice(0, 24)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Gasto municipal"
        description="Drilldowns por municipio o literal territorial local publicado en BDNS y PCSP. Cuando la fuente no publica un municipio reutilizable, el registro se contabiliza como cobertura no resuelta."
      />

      <SourceFootnote
        sourceLabel="BDNS · PCSP"
        sourceHref="https://contrataciondelestado.es"
        latestRecordDate={latestDate ?? null}
        coverageLabel={`${territories.length.toLocaleString("es-ES")} territorios resueltos · ${summary.subsidyCount.toLocaleString("es-ES")} subvenciones · ${summary.contractCount.toLocaleString("es-ES")} contratos`}
      />

      <StatGrid
        items={[
          { label: "Territorios con drilldown", value: territories.length.toLocaleString("es-ES") },
          { label: "Subvenciones (LOCAL)", value: summary.subsidyCount.toLocaleString("es-ES") },
          { label: "Contratos (municipal)", value: summary.contractCount.toLocaleString("es-ES") },
        ]}
      />

      {!hasData ? (
        <EmptyState
          title="Sin registros locales en la muestra"
          description={
            <>
              La clasificación municipal depende de los campos territoriales publicados por cada
              fuente. Consulta el{" "}
              <ResponsiveLink href="/estado-datos" className="underline-offset-2 hover:underline">
                estado de los datos
              </ResponsiveLink>
              .
            </>
          }
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Municipios y entidades locales con registros resueltos
            </h2>
            {visibleTerritories.length === 0 ? (
              <EmptyState
                title="Sin territorio local resoluble"
                description="Hay registros con nivel local, pero no exponen un nombre territorial reutilizable para construir una ruta pública por municipio."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleTerritories.map((territory) => (
                  <ResponsiveLink
                    key={territory.territoryKey}
                    href={`/municipios/${encodeURIComponent(territory.territoryKey)}`}
                    className="block rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
                  >
                    <div className="font-medium">{territory.territoryName}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {territory.subsidyCount.toLocaleString("es-ES")} subvenciones ·{" "}
                      {territory.contractCount.toLocaleString("es-ES")} contratos
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatAmount(territory.subsidyAmount + territory.contractAmount)}
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
                    {row.resolvedCount.toLocaleString("es-ES")}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sin territorio reutilizable:</span>{" "}
                    {row.unresolvedCount.toLocaleString("es-ES")}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {row.dataset === "subsidies"
                      ? "Subvenciones agrupadas por el literal territorial publicado en nivel2."
                      : "Contratos agrupados por el literal publicado en region. Nombres idénticos pueden mezclar entidades si la fuente no aporta más detalle."}
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
              href="/subvenciones?nivel=LOCAL"
              className="block rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
            >
              <span className="font-medium">Subvenciones locales</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                Filtro nivel LOCAL en BDNS
              </span>
            </ResponsiveLink>
          </li>
          <li>
            <ResponsiveLink
              href="/contratos?level=municipal"
              className="block rounded-[2px] border border-border bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
            >
              <span className="font-medium">Contratos municipales</span>
              <span className="mt-1 block font-mono text-xs text-muted-foreground">
                Contratos con administration_level municipal
              </span>
            </ResponsiveLink>
          </li>
        </ul>
      </section>
    </div>
  )
}
