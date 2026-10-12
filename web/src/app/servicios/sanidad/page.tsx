import Link from "next/link"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { getServiceWaiting } from "@/lib/data/service-waiting"
import { getExpenditureFunctions } from "@/lib/data/cofog"
import {
  selectWaitingRow,
  WAITING_SOURCE,
  WAITING_CORRECTION,
} from "@/lib/service-waiting"
import { selectCofogYear, COFOG_SOURCE } from "@/lib/cofog"
export const revalidate = 3600
export const metadata = {
  title: "Espera quirúrgica y gasto sanitario",
  description:
    "Pacientes pendientes de cirugía, tiempo transcurrido y gasto en salud: territorio, corte, revisión y límites de comparación.",
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    territory?: string | string[]
    cut?: string | string[]
    spendingYear?: string | string[]
  }>
}) {
  const params = await searchParams
  const [waiting, spending] = await Promise.all([
    getServiceWaiting(),
    getExpenditureFunctions(),
  ])
  const snapshot = waiting.snapshot
  const row = snapshot
    ? selectWaitingRow(snapshot, params?.territory, params?.cut)
    : undefined
  const national = snapshot?.rows.find((r) => r.code === "ES")
  const year = selectCofogYear(spending.years, params?.spendingYear)
  const number = (v: number) =>
    v.toLocaleString("es-ES", { maximumFractionDigits: 2 })
  return (
    <div className="ui-page space-y-8">
      <PageHeader
        title="¿Cuántos pacientes siguen esperando una operación?"
        description="Espera estructural para cirugía programada no urgente. Consulta tu administración y el tiempo que los pacientes ya llevan en la lista."
      />
      <section className="space-y-4" aria-labelledby="waiting-title">
        <h2 id="waiting-title" className="text-xl font-semibold">
          Pacientes pendientes · corte de 31 de diciembre de 2025
        </h2>
        <p className="text-sm leading-6">
          Edición rectificada por correcciones de Castilla-La Mancha
          {snapshot
            ? ` · actualización anunciada: ${snapshot.revision_date}`
            : ""}
          .{" "}
          <a
            href={WAITING_CORRECTION}
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Nota oficial de rectificación
          </a>
          .
        </p>
        {waiting.error ? (
          <p role="alert">
            No se ha podido consultar una edición validada. Un fallo no
            significa cero pacientes.
          </p>
        ) : !snapshot ? (
          <p role="status">Todavía no hay una edición disponible.</p>
        ) : (
          <>
            <form
              action="/servicios/sanidad"
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="cut" value={snapshot.cut} />
              {typeof params?.spendingYear === "string" && (
                <input
                  type="hidden"
                  name="spendingYear"
                  value={params.spendingYear}
                />
              )}
              <label htmlFor="waiting-territory" className="text-sm">
                Administración sanitaria
                <select
                  id="waiting-territory"
                  name="territory"
                  defaultValue={row?.code ?? ""}
                  className="block max-w-full rounded border bg-background p-2"
                >
                  {!row && (
                    <option value="" disabled>
                      Selección no disponible
                    </option>
                  )}
                  {[...snapshot.rows]
                    .sort((a, b) =>
                      a.code === "ES"
                        ? -1
                        : b.code === "ES"
                          ? 1
                          : a.code.localeCompare(b.code),
                    )
                    .map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                </select>
              </label>
              <button className="rounded border px-3 py-2 text-sm">
                Ver administración
              </button>
              <Link
                href="/servicios/sanidad?cut=2025-12-31&territory=ES"
                className="py-2 text-sm underline"
              >
                Restablecer consulta
              </Link>
            </form>
            {!row ? (
              <p role="status">
                El territorio o corte solicitado no está disponible. No se
                sustituye por otro.
              </p>
            ) : (
              <>
                <h3 className="text-lg font-semibold">{row.label}</h3>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    [
                      "Pacientes pendientes",
                      number(row.patients),
                      "En lista estructural a la fecha de corte; no son todas las intervenciones del año.",
                    ],
                    [
                      "Pacientes por 1.000 tarjetas sanitarias",
                      number(row.rate),
                      "Denominador de población protegida del SNS, no población residente del INE.",
                    ],
                    [
                      "Tiempo medio ya transcurrido",
                      `${number(row.mean_days)} días`,
                      "Tiempo de los pacientes todavía pendientes; no promete una fecha de operación.",
                    ],
                    [
                      "Más de seis meses esperando",
                      `${number(row.over_six_months)} pacientes`,
                      `${number(row.over_six_share)} % de la lista de esta administración.`,
                    ],
                  ].map(([label, value, note]) => (
                    <div key={label} className="min-w-0 border-t pt-3">
                      <dt className="text-sm font-semibold">{label}</dt>
                      <dd>
                        <p className="font-mono text-2xl tabular-nums">
                          {value}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {note}
                        </p>
                      </dd>
                    </div>
                  ))}
                </dl>
                {row.code !== "ES" && national && (
                  <p className="text-sm leading-6">
                    Referencia SNS del mismo corte: {number(national.rate)}{" "}
                    pacientes por 1.000 tarjetas y {number(national.mean_days)}{" "}
                    días medios. Es una media ponderada por pacientes; no se
                    obtiene promediando las comunidades por igual.
                  </p>
                )}
                <Link
                  className="text-sm underline"
                  href={`/servicios/sanidad?cut=${snapshot.cut}&territory=${row.code}${year ? `&spendingYear=${year.year}` : ""}`}
                >
                  Enlace a esta consulta
                </Link>
              </>
            )}
            <SourceFootnote
              sourceLabel={`Sanidad · SISLE-SNS · página ${snapshot.source_page} · revisión ${snapshot.revision_date}`}
              sourceHref={`${WAITING_SOURCE}#page=8`}
              lastChecked={snapshot.retrieved_at}
              coverageLabel="17 comunidades, Ceuta y Melilla · cirugía no urgente"
            />
          </>
        )}
        <p className="text-sm leading-6 text-muted-foreground">
          La espera estructural recoge pacientes que pueden ser atendidos y cuya
          espera se atribuye a organización o recursos. La composición clínica y
          los criterios de registro limitan la comparación: esta tabla no
          demuestra eficiencia ni calidad de cada servicio.
        </p>
      </section>
      <section
        className="space-y-4 rounded border p-4 sm:p-6"
        aria-labelledby="health-spending-title"
      >
        <h2 id="health-spending-title" className="text-xl font-semibold">
          ¿Qué gasto público en salud sirve de contexto?
        </h2>
        <p className="text-sm leading-6">
          España · todas las administraciones consolidadas (S13) · función COFOG
          GF07. Incluye hospitales, productos médicos y salud pública; su
          perímetro es mayor que la lista quirúrgica.
        </p>
        {spending.error ? (
          <p role="alert">No se ha podido consultar el gasto sanitario.</p>
        ) : (
          <>
            <form
              action="/servicios/sanidad"
              className="flex flex-wrap items-end gap-3"
            >
              {typeof params?.territory === "string" && (
                <input
                  type="hidden"
                  name="territory"
                  value={params.territory}
                />
              )}
              {typeof params?.cut === "string" && (
                <input type="hidden" name="cut" value={params.cut} />
              )}
              <label htmlFor="health-spending-year" className="text-sm">
                Año del gasto nacional
                <select
                  id="health-spending-year"
                  name="spendingYear"
                  defaultValue={year?.year ?? ""}
                  className="ml-2 rounded border bg-background p-2"
                >
                  {!year && (
                    <option value="" disabled>
                      Año no disponible
                    </option>
                  )}
                  {spending.years.map((y) => (
                    <option key={y.year} value={y.year}>
                      {y.year}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded border px-3 py-2 text-sm">
                Ver gasto
              </button>
            </form>
            {year ? (
              <>
                <p className="font-mono text-2xl">
                  {number(year.values.GF07)} millones de euros · {year.year}
                </p>
                <p className="text-sm">
                  Gasto realizado de contabilidad nacional, en euros corrientes;
                  no es presupuesto autorizado ni pagos de caja.
                  {year.provisional ? " Datos provisionales." : ""}
                </p>
                <Link
                  href={`/gasto-por-funciones?year=${year.year}`}
                  className="text-sm underline"
                >
                  Ver gasto reconciliado por funciones
                </Link>
                <SourceFootnote
                  sourceLabel="Eurostat · gov_10a_exp · ES/S13/GF07 · MIO_EUR"
                  sourceHref={COFOG_SOURCE}
                  lastChecked={year.lastChecked}
                />
              </>
            ) : (
              <p role="status">
                El año solicitado no tiene un desglose reconciliado disponible.
              </p>
            )}
          </>
        )}
        <p className="text-sm leading-6">
          El año del gasto y el corte de espera tienen selecciones
          independientes. El gasto nacional no se atribuye a la administración
          elegida. Mostrar ambas medidas no prueba que una cause la otra:
          tampoco permite calcular un coste por paciente pendiente.
        </p>
      </section>
      <Link href="/dinero" className="text-sm underline">
        Volver a dinero público
      </Link>
    </div>
  )
}
