import Link from "next/link"
import { Pagination } from "@/components/domain/Pagination"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { getDusProgram } from "@/lib/data/prtr-program"
import {
  DUS_PROGRAM_URL,
  DUS_LIST_URL,
  dusEuro,
  selectDusProjects,
  summarizeDus,
} from "@/lib/prtr-program"
export const revalidate = 3600
export const metadata = {
  title: "PRTR · Programa DUS 5000",
  description:
    "Qué financia el MRR en DUS 5000: presupuesto territorial y ayuda concedida por expediente, con fuentes y fases diferenciadas.",
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    territory?: string | string[]
    q?: string | string[]
    page?: string | string[]
  }>
}) {
  const params = await searchParams
  const { snapshot, error } = await getDusProgram()
  const rows = snapshot
    ? selectDusProjects(snapshot, params?.territory, params?.q)
    : null
  const page =
    params?.page === undefined
      ? 1
      : typeof params.page === "string" && /^[1-9]\d{0,4}$/.test(params.page)
        ? Number(params.page)
        : NaN
  const totalPages = rows ? Math.max(1, Math.ceil(rows.length / 25)) : 1
  const valid = rows !== null && Number.isInteger(page) && page <= totalPages
  const summary = rows ? summarizeDus(rows) : null
  const resolutions = snapshot?.rows.map((r) => r.last_resolution).sort() ?? []
  const territory = snapshot?.territories.find(
    (t) => t.code === params?.territory,
  )
  const href = (p: number) => {
    const query = new URLSearchParams()
    if (typeof params?.territory === "string")
      query.set("territory", params.territory)
    if (typeof params?.q === "string") query.set("q", params.q)
    query.set("page", String(p))
    return `/fondos-ue/prtr?${query}`
  }
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="¿Qué financia DUS 5000 y qué fase está acreditada?"
        description="Subvenciones para proyectos locales de energía limpia. Instrumento MRR/PRTR, gestión IDAE; este piloto acredita importes de concesión publicados, no pagos ni proyectos terminados."
      />
      <Link href="/fondos-ue/prtr/instrumentos" className="block underline">Subvenciones y financiación ICO: comparar instrumentos y fases</Link>
      <div className="rounded border p-4 space-y-3">
        <h2 className="text-xl font-semibold">
          Presupuesto del programa · desde 2021
        </h2>
        <p className="font-mono text-2xl">675 millones de euros</p>
        <p className="text-sm leading-6">
          Dotación final publicada en la sede IDAE, repartida entre 17
          comunidades. No se suma a la ayuda concedida como otro fondo ni se
          resta de ella para estimar dinero pendiente de ejecutar. DUS 5000
          ofrece subvenciones; los préstamos del MRR corresponden a otros
          instrumentos y no están incluidos aquí.
        </p>
        <a
          href={DUS_PROGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Fuente del programa y bases de las ayudas
        </a>
      </div>
      {error ? (
        <p role="alert">
          No se ha podido consultar una edición validada del programa. Un error
          no significa que no haya ayudas.
        </p>
      ) : !snapshot ? (
        <p role="status">El listado de expedientes aún no está disponible.</p>
      ) : (
        <>
          <form
            action="/fondos-ue/prtr"
            className="flex flex-wrap items-end gap-3"
          >
            <label htmlFor="dus-territory" className="text-sm">
              Comunidad del listado
              <select
                id="dus-territory"
                name="territory"
                defaultValue={territory?.code ?? ""}
                className="block max-w-full rounded border bg-background p-2"
              >
                <option value="">Todas las comunidades</option>
                {snapshot.territories.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="dus-query" className="text-sm">
              Expediente, entidad o proyecto
              <input
                id="dus-query"
                name="q"
                maxLength={120}
                defaultValue={typeof params?.q === "string" ? params.q : ""}
                className="block w-full rounded border bg-background p-2"
              />
            </label>
            <button className="rounded border px-3 py-2 text-sm">
              Consultar
            </button>
            <Link href="/fondos-ue/prtr" className="py-2 text-sm underline">
              Restablecer consulta
            </Link>
          </form>
          {!valid || !summary ? (
            <p role="status">
              La selección o página solicitada no está disponible. No se
              sustituye por otra consulta.
            </p>
          ) : (
            <>
              <h2 className="text-xl font-semibold">
                Ayuda concedida publicada ·{" "}
                {territory?.label ?? "todas las comunidades"}
              </h2>
              <p className="text-sm leading-6">
                Se suman los importes actuales de los expedientes de esta
                consulta: {summary.records.toLocaleString("es-ES")} registros,
                no toda la ejecución del PRTR. La fecha es la última resolución,
                que puede revisar una concesión anterior; no permite sumar
                concesiones nuevas por año.
              </p>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-semibold">
                    Importes conocidos de la consulta
                  </dt>
                  <dd className="font-mono text-xl">
                    {dusEuro(summary.known_grant_cents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">
                    Importes ausentes / importes cero
                  </dt>
                  <dd>
                    {summary.unknown_amounts} / {summary.zero_amounts}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">
                    Proyectos sin nombre publicado
                  </dt>
                  <dd>{summary.unknown_projects}</dd>
                </div>
                {territory && (
                  <div>
                    <dt className="text-sm font-semibold">
                      Presupuesto territorial del programa
                    </dt>
                    <dd>
                      {dusEuro(territory.budget_cents)} · distinto de esta
                      consulta de expedientes
                    </dd>
                  </div>
                )}
              </dl>
              <p className="text-sm leading-6">
                Un importe cero no acredita cancelación. No disponer del pago en
                esta fuente tampoco prueba que no se haya pagado. El municipio y
                la provincia son campos del listado; no acreditan el lugar
                exacto beneficiado por una diputación o mancomunidad.
              </p>
              {rows!.length === 0 ? (
                <p role="status">
                  No hay expedientes publicados que coincidan con esta consulta.
                </p>
              ) : (
                <div className="space-y-3">
                  {rows!.slice((page - 1) * 25, page * 25).map((r) => (
                    <article
                      key={r.id}
                      className="min-w-0 space-y-2 rounded border p-4"
                    >
                      <Link
                        href={`/fondos-ue/prtr/${r.id}${href(page).slice("/fondos-ue/prtr".length)}`}
                        className="block break-words font-semibold underline"
                      >
                        {r.project ?? "Nombre de proyecto no publicado"}
                      </Link>
                      <p className="text-sm break-words">{r.beneficiary}</p>
                      <p className="text-xs font-mono break-words">
                        {r.id} · última resolución {r.last_resolution}
                      </p>
                      <p className="font-mono">
                        {dusEuro(r.grant_cents)} · concesión publicada
                      </p>
                    </article>
                  ))}
                </div>
              )}
              <Pagination
                page={page}
                totalPages={totalPages}
                hrefForPage={href}
              />
              <Link href={href(page)} className="text-sm underline">
                Enlace a esta consulta
              </Link>
            </>
          )}
          <SourceFootnote
            sourceLabel="IDAE · listado de resoluciones favorables D5000"
            sourceHref={DUS_LIST_URL}
            lastChecked={snapshot.retrieved_at}
            coverageLabel={`${snapshot.rows.length} expedientes disponibles · últimas resoluciones ${resolutions[0]}–${resolutions.at(-1)} · no flujo anual`}
          />
        </>
      )}
      <Link href="/fondos-ue" className="text-sm underline">
        Volver a instrumentos europeos y Kohesio
      </Link>
    </div>
  )
}
