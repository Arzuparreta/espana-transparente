import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getAutonomicSummary } from "@/lib/data/multilevel"

export const revalidate = 3600

export const metadata = {
  title: "Gasto autonómico",
  description:
    "Subvenciones y contratos publicados con ámbito autonómico en la BDNS y la Plataforma de Contratación.",
}

export default async function CcaaPage() {
  const summary = await getAutonomicSummary()
  const hasData = summary.subsidyCount > 0 || summary.contractCount > 0
  const latestDate = [summary.subsidyLatestDate, summary.contractLatestDate]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Gasto autonómico"
        description="Registros publicados con ámbito de comunidad autónoma. La cobertura depende de lo que cada administración publica en BDNS y PCSP."
      />

      <SourceFootnote
        sourceLabel="BDNS · PCSP"
        sourceHref="https://www.pap.hacienda.gob.es/bdnstrans/GE/es/convocatorias"
        latestRecordDate={latestDate ?? null}
        coverageLabel={`${summary.subsidyCount.toLocaleString("es-ES")} subvenciones · ${summary.contractCount.toLocaleString("es-ES")} contratos con nivel autonómico`}
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
        <StatGrid
          items={[
            {
              label: "Subvenciones (AUTONOMICA)",
              value: summary.subsidyCount.toLocaleString("es-ES"),
            },
            {
              label: "Contratos (autonómico)",
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

      <p className="text-xs leading-5 text-muted-foreground">
        No hay aún una página por comunidad autónoma: el desglose territorial en subvenciones
        depende de los campos nivel2 y nivel3 publicados en cada concesión.
      </p>
    </div>
  )
}
