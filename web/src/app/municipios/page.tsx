import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getMunicipalSummary } from "@/lib/data/multilevel"

export const revalidate = 3600

export const metadata = {
  title: "Gasto municipal",
  description:
    "Subvenciones y contratos publicados con ámbito local en la BDNS y la Plataforma de Contratación.",
}

export default async function MunicipiosPage() {
  const summary = await getMunicipalSummary()
  const hasData = summary.subsidyCount > 0 || summary.contractCount > 0
  const latestDate = [summary.subsidyLatestDate, summary.contractLatestDate]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Gasto municipal"
        description="Registros publicados con ámbito local. Incluye ayuntamientos y otras entidades locales cuando el dato de origen lo identifica."
      />

      <SourceFootnote
        sourceLabel="BDNS · PCSP"
        sourceHref="https://contrataciondelestado.es"
        latestRecordDate={latestDate ?? null}
        coverageLabel={`${summary.subsidyCount.toLocaleString("es-ES")} subvenciones · ${summary.contractCount.toLocaleString("es-ES")} contratos con nivel municipal`}
      />

      {!hasData ? (
        <EmptyState
          title="Sin registros locales en la muestra"
          description={
            <>
              La clasificación municipal en contratos depende del campo administration_level.
              Consulta el{" "}
              <ResponsiveLink href="/estado-datos" className="underline-offset-2 hover:underline">
                estado de los datos
              </ResponsiveLink>
              .
            </>
          }
        />
      ) : (
        <StatGrid
          items={[
            {
              label: "Subvenciones (LOCAL)",
              value: summary.subsidyCount.toLocaleString("es-ES"),
            },
            {
              label: "Contratos (municipal)",
              value: summary.contractCount.toLocaleString("es-ES"),
            },
          ]}
        />
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

      <p className="text-xs leading-5 text-muted-foreground">
        Muchos contratos de ayuntamientos aparecen con el nombre del órgano adjudicador sin
        nivel municipal resuelto; la cobertura mejora conforme el ETL clasifica más registros.
      </p>
    </div>
  )
}
