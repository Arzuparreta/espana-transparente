import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getMoneyDataOverview, getEtlPipelineStatus } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Estado de los datos",
  description: "Cobertura, frescura y fuentes de cada vertical del portal: votaciones, contratos, subvenciones, presupuestos y más.",
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function levelLabel(value: string) {
  switch (value) {
    case "state":
      return "Estado"
    case "autonomic":
      return "CCAA"
    case "municipal":
      return "Municipios"
    default:
      return "Sin clasificar"
  }
}

function datasetLabel(value: string) {
  return value === "contracts" ? "Contratos" : "Subvenciones"
}

const PIPELINE_LABELS: Record<string, string> = {
  "congreso.diputados": "Diputados",
  "congreso.asistencia": "Asistencia y votaciones",
  "congreso.cods": "Expedientes (CODs)",
  "congreso.declaraciones": "Declaraciones económicas",
  "congreso.gobierno": "Gobierno",
  "congreso.responsables": "Responsables",
  "ine.indicadores": "Indicadores INE",
  "contratacion.contratos": "Contratos PCSP",
  "bdns.subvenciones": "Subvenciones BDNS",
  "photos.run": "Fotos",
  "puertas_giratorias": "Puertas giratorias",
  "kohesio.fondos_ue": "Fondos UE",
  "senado.votaciones": "Sesiones Senado",
  "common.search_refresh": "Búsqueda (actualización)",
}

export default async function EstadoDatosPage() {
  const [{ coverage, examples }, pipelines] = await Promise.all([
    getMoneyDataOverview(),
    getEtlPipelineStatus(),
  ])
  const coverageByDataset = coverage.reduce<Record<string, typeof coverage>>((acc, row) => {
    acc[row.dataset] = [...(acc[row.dataset] ?? []), row]
    return acc
  }, {})

  const examplesByDataset = examples.reduce<Record<string, typeof examples>>((acc, row) => {
    acc[row.dataset] = [...(acc[row.dataset] ?? []), row]
    return acc
  }, {})

  const lastChecked =
    pipelines
      .map((p) => (p.last_finished_at as string | null) ?? null)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        title="Estado de datos"
        description="Frescura de pipelines ETL, cobertura histórica y conflictos de resolución de responsable."
      />

      <SourceFootnote
        sourceLabel={`${pipelines.length} pipelines registrados`}
        lastChecked={lastChecked}
        coverageLabel="Frescura por dataset"
        statusHref={null}
      />

      {/* ETL pipeline freshness */}
      {pipelines.length > 0 && (
        <section className="space-y-4 rounded-xl border border-border/70 bg-card/80 p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Pipelines ETL</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4">Pipeline</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2 pr-4">Último éxito</th>
                  <th className="pb-2 pr-4">Filas insertadas</th>
                  <th className="pb-2">Filas actualizadas</th>
                </tr>
              </thead>
              <tbody>
                {pipelines.map((p) => {
                  const label = PIPELINE_LABELS[p.pipeline as string] ?? String(p.pipeline)
                  const status = p.last_status as string
                  const finishedAt = p.last_finished_at as string | null
                  const dateStr = finishedAt
                    ? new Date(finishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                    : "—"
                  const statusClass =
                    status === "succeeded"
                      ? "text-green-600 dark:text-green-400"
                      : status === "failed"
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"

                  return (
                    <tr key={String(p.pipeline)} className="border-t border-border/60">
                      <td className="py-3 pr-4 font-medium">{label}</td>
                      <td className={`py-3 pr-4 ${statusClass}`}>
                        {status === "succeeded" ? "OK" : status === "failed" ? "Error" : status ?? "—"}
                      </td>
                      <td className="py-3 pr-4">{dateStr}</td>
                      <td className="py-3 pr-4 tabular-nums">{(p.last_rows_inserted as number)?.toLocaleString("es-ES") ?? "—"}</td>
                      <td className="py-3 tabular-nums">{(p.last_rows_updated as number)?.toLocaleString("es-ES") ?? "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {pipelines.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay ejecuciones de ETL registradas.</p>
          )}
        </section>
      )}

      {(["contracts", "subsidies"] as const).map((dataset) => {
        const rows = coverageByDataset[dataset] ?? []
        const examplesRows = examplesByDataset[dataset] ?? []

        return (
          <section key={dataset} className="space-y-4 rounded-xl border border-border/70 bg-card/80 p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold">{datasetLabel(dataset)}</h2>
                <p className="text-sm text-muted-foreground">
                  {dataset === "contracts"
                    ? "Cobertura y resolución pública del bloque de licitaciones."
                    : "Cobertura y resolución pública del bloque de concesiones."}
                </p>
              </div>
              <ResponsiveLink
                href={dataset === "contracts" ? "/contratos" : "/subvenciones"}
                className="shrink-0 text-sm font-medium underline-offset-2 hover:underline"
              >
                Abrir {dataset === "contracts" ? "contratos" : "subvenciones"} →
              </ResponsiveLink>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-4">Nivel</th>
                    <th className="pb-2 pr-4">Filas</th>
                    <th className="pb-2 pr-4">Resueltas</th>
                    <th className="pb-2 pr-4">Sin resolver</th>
                    <th className="pb-2 pr-4">Conflictos</th>
                    <th className="pb-2 pr-4">Inicio</th>
                    <th className="pb-2">Último dato</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${dataset}-${row.administration_level}`} className="border-t border-border/60">
                      <td className="py-3 pr-4 font-medium">{levelLabel(row.administration_level)}</td>
                      <td className="py-3 pr-4 tabular-nums">{row.total_rows.toLocaleString("es-ES")}</td>
                      <td className="py-3 pr-4 tabular-nums">{row.resolved_rows.toLocaleString("es-ES")}</td>
                      <td className="py-3 pr-4 tabular-nums">{row.unresolved_rows.toLocaleString("es-ES")}</td>
                      <td className="py-3 pr-4 tabular-nums">{row.conflict_rows.toLocaleString("es-ES")}</td>
                      <td className="py-3 pr-4">{formatDate(row.coverage_start_date)}</td>
                      <td className="py-3">{formatDate(row.latest_record_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Ejemplos abiertos</h3>
              {examplesRows.length === 0 ? (
                <EmptyState
                  title="Sin ejemplos abiertos"
                  description="No hay conflictos o registros sin resolver en la muestra pública."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {examplesRows.map((row) => (
                    <article key={row.record_id} className="rounded-2xl border border-border/60 bg-background/70 p-3">
                      <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">{levelLabel(row.administration_level ?? "sin_clasificar")}</span>
                        <span className="shrink-0">{row.issue_type === "conflict" ? "Conflicto" : "Sin resolver"}</span>
                      </div>
                      <div className="mt-2 text-sm font-medium">{row.body_name ?? row.body_normalized ?? "—"}</div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {row.display_title ?? "Sin título descriptivo"}
                      </div>
                      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-muted-foreground">{formatDate(row.record_date)}</span>
                        {row.source_url ? (
                          <a
                            href={row.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 font-medium underline-offset-2 hover:underline"
                          >
                            Ver fuente →
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
