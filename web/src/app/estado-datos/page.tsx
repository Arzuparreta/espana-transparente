import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getMoneyDataOverview, getEtlPipelineStatus } from "@/lib/data"
import { getOrgGeolocationCoverage } from "@/lib/data/multilevel"
import { checkDatabaseHealth } from "@/lib/data/database-health"
import {
  getCriticalPipelineStatuses,
  getEtlPipelineLabel,
  getPipelineDisplayStatus,
  type EtlPipelineRow,
} from "@/lib/etl-pipelines"
import { Fragment } from "react"
import { COVERED_QUESTIONS, questionStatuses, type QuestionStatus } from "@/lib/question-coverage"

const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  fresh: "Ingesta al día",
  delayed: "Ingesta retrasada: la respuesta puede no incluir la última publicación",
  failed: "Última ingesta fallida: se muestra el último dato validado",
  missing: "Sin ejecución registrada de la ingesta",
  unmonitored: "Estado de ingesta no disponible",
}
const QUESTION_STATUS_CLASS: Record<QuestionStatus, string> = {
  fresh: "text-green-600 dark:text-green-400",
  delayed: "text-amber-700 dark:text-amber-400",
  failed: "text-red-600 dark:text-red-400",
  missing: "text-amber-700 dark:text-amber-400",
  unmonitored: "text-muted-foreground",
}

export const revalidate = 0

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

export default async function EstadoDatosPage() {
  const [moneyOverview, pipelineResult, geoCoverage, databaseAvailable] = await Promise.all([
    getMoneyDataOverview(),
    getEtlPipelineStatus(),
    getOrgGeolocationCoverage(),
    checkDatabaseHealth().then(
      () => true,
      () => false
    ),
  ])
  const { coverage, examples } = moneyOverview
  const pipelines = pipelineResult.pipelines
  const dataUnavailable =
    !databaseAvailable ||
    moneyOverview.status === "unavailable" ||
    pipelineResult.status === "unavailable"
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
  const now = new Date()
  const criticalStatuses = getCriticalPipelineStatuses(pipelines as EtlPipelineRow[], now)
  const delayedCritical = criticalStatuses.filter((row) => row.status !== "fresh")
  // Without the pipeline table a status would be a guess: show the questions, not a freshness claim.
  const questions = questionStatuses(COVERED_QUESTIONS, dataUnavailable ? [] : criticalStatuses)

  return (
    <div className="ui-page">
      <PageHeader
        title="Estado de datos"
        description="Qué preguntas puede responder el portal, con qué fuente y qué deja fuera cada respuesta; después, frescura de cada ingesta y cobertura histórica."
      />

      <section className="space-y-4" aria-labelledby="covered-questions">
        <div className="space-y-1">
          <h2 id="covered-questions" className="text-xl font-semibold">¿Qué preguntas podemos responder?</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Cada respuesta tiene su fuente, periodo y perímetro. Que la ingesta esté al día prueba que la fuente se leyó, no que la respuesta sea exhaustiva: lo que queda fuera se indica en cada caso.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2">
          {questions.map((question) => (
            <li key={question.href + question.question} className="min-w-0 space-y-2 rounded-[2px] border border-border p-4 text-sm leading-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{question.area}</p>
              <ResponsiveLink href={question.href} className="block font-semibold underline-offset-2 hover:underline">
                {question.question}
              </ResponsiveLink>
              <p><span className="text-muted-foreground">Fuente:</span> {question.source}</p>
              <p><span className="text-muted-foreground">Cubre:</span> {question.covers}</p>
              <p><span className="text-muted-foreground">No cubre:</span> {question.excludes}</p>
              <p className={QUESTION_STATUS_CLASS[question.status]}>{QUESTION_STATUS_LABEL[question.status]}</p>
            </li>
          ))}
        </ul>
      </section>

      <SourceFootnote
        sourceLabel={dataUnavailable ? "Consulta no disponible" : `${pipelines.length} pipelines registrados`}
        lastChecked={lastChecked}
        coverageLabel={dataUnavailable ? "Base de datos no disponible" : "Frescura por dataset"}
        statusHref={null}
      />

      {dataUnavailable && (
        <EmptyState
          title="Estado temporalmente no disponible"
          description="No se ha podido consultar la base de datos. Esta pantalla no interpreta un fallo de conexión como ausencia de datos."
        />
      )}

      {!dataUnavailable && (
        <section className="space-y-4 rounded-[2px] border border-border bg-card p-4 sm:p-5">
          <div>
            <h2 className="text-xl font-semibold">Fuentes críticas</h2>
            <p className="text-sm text-muted-foreground">
              Las fuentes diarias se consideran retrasadas tras 36 horas; las semanales, tras 9 días.
            </p>
          </div>
          {delayedCritical.length === 0 ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              Todas las fuentes críticas están dentro de su ventana de actualización.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {delayedCritical.map((pipeline) => (
                <div key={pipeline.key} className="border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
                  <span className="font-medium">{pipeline.label}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {pipeline.status === "missing"
                      ? "Sin ejecución"
                      : pipeline.status === "failed"
                        ? "Error"
                        : "Retrasado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ETL pipeline freshness */}
      {!dataUnavailable && pipelines.length > 0 && (
        <section className="space-y-4 rounded-[2px] border border-border bg-card p-4 sm:p-5">
          <h2 className="text-xl font-semibold">Pipelines ETL</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4">Pipeline</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2 pr-4">Última ejecución</th>
                  <th className="pb-2 pr-4">Filas insertadas</th>
                  <th className="pb-2">Filas actualizadas</th>
                </tr>
              </thead>
              <tbody>
                {pipelines.map((p) => {
                  const label = getEtlPipelineLabel(String(p.pipeline))
                  const status = p.last_status as string
                  const finishedAt = p.last_finished_at as string | null
                  const dateStr = finishedAt
                    ? new Date(finishedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                    : "—"
                  const displayStatus = getPipelineDisplayStatus(
                    p as EtlPipelineRow,
                    now
                  )
                  const statusClass =
                    displayStatus === "ok"
                      ? "text-green-600 dark:text-green-400"
                      : displayStatus === "failed"
                        ? "text-red-600 dark:text-red-400"
                        : displayStatus === "delayed"
                          ? "text-amber-700 dark:text-amber-400"
                        : "text-muted-foreground"

                  return (
                    <Fragment key={String(p.pipeline)}>
                      <tr className="border-t border-border/60">
                        <td className="py-3 pr-4 font-medium">{label}</td>
                        <td className={`py-3 pr-4 ${statusClass}`}>
                          {displayStatus === "ok"
                            ? "OK"
                            : displayStatus === "failed"
                              ? "Error"
                              : displayStatus === "delayed"
                                ? "Retrasado"
                                : status ?? "—"}
                        </td>
                        <td className="py-3 pr-4">{dateStr}</td>
                        <td className="py-3 pr-4 font-mono">{(p.last_rows_inserted as number)?.toLocaleString("es-ES") ?? "—"}</td>
                        <td className="py-3 font-mono">{(p.last_rows_updated as number)?.toLocaleString("es-ES") ?? "—"}</td>
                      </tr>
                      {status === "failed" && p.last_error_summary ? (
                        <tr className="border-t border-border/30">
                          <td colSpan={5} className="pb-3 pt-1 text-xs text-red-600 dark:text-red-400">
                            {String(p.last_error_summary)}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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

      {!dataUnavailable && geoCoverage && geoCoverage.totalOrgs > 0 ? (
        <section className="space-y-4 rounded-[2px] border border-border bg-card p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Geolocalización de receptores</h2>
            <p className="text-sm text-muted-foreground">
              Ubicación resuelta de las organizaciones que reciben dinero público (empresas y
              entidades), para responder &laquo;a dónde llega&raquo; por territorio. Cobertura
              parcial: se resuelve por CIF y por el nombre del organismo, no para todos los registros.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-[2px] border border-border/60 bg-background/70 p-3">
              <div className="font-mono text-lg">
                {Math.round((geoCoverage.locatedOrgs / geoCoverage.totalOrgs) * 100)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {geoCoverage.locatedOrgs.toLocaleString("es-ES")} de{" "}
                {geoCoverage.totalOrgs.toLocaleString("es-ES")} organizaciones ubicadas
              </div>
            </div>
            <div className="rounded-[2px] border border-border/60 bg-background/70 p-3">
              <div className="font-mono text-lg">{geoCoverage.viaCif.toLocaleString("es-ES")}</div>
              <div className="text-xs text-muted-foreground">vía CIF (provincia)</div>
            </div>
            <div className="rounded-[2px] border border-border/60 bg-background/70 p-3">
              <div className="font-mono text-lg">{geoCoverage.viaNameMatch.toLocaleString("es-ES")}</div>
              <div className="text-xs text-muted-foreground">vía nombre (municipio)</div>
            </div>
          </div>
        </section>
      ) : null}

      {!dataUnavailable && (["contracts", "subsidies"] as const).map((dataset) => {
        const rows = coverageByDataset[dataset] ?? []
        const examplesRows = examplesByDataset[dataset] ?? []

        return (
          <section key={dataset} className="space-y-4 rounded-[2px] border border-border bg-card p-4 sm:p-5">
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
                      <td className="py-3 pr-4 font-mono">{row.total_rows.toLocaleString("es-ES")}</td>
                      <td className="py-3 pr-4 font-mono">{row.resolved_rows.toLocaleString("es-ES")}</td>
                      <td className="py-3 pr-4 font-mono">{row.unresolved_rows.toLocaleString("es-ES")}</td>
                      <td className="py-3 pr-4 font-mono">{row.conflict_rows.toLocaleString("es-ES")}</td>
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
                  description="No hay ejemplos disponibles en esta muestra. Consulta los recuentos de cobertura para conocer los registros pendientes."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {examplesRows.map((row) => (
                    <article key={row.record_id} className="rounded-[2px] border border-border/60 bg-background/70 p-3">
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
