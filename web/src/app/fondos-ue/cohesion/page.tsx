import Link from "next/link"
import { PageHeader } from "@/components/domain/PageHeader"
import { getCohesionProgrammes } from "@/lib/data/cohesion-program"
import {
  cohesionYears,
  selectCohesionYear,
  cohesionHref,
  cohesionAmount,
} from "@/lib/cohesion-program"
export const revalidate = 3600
export const metadata = {
  title: "Cohesión · Programas FEDER",
  description:
    "Coste previsto, proyectos seleccionados, gasto declarado y transferencias netas por programa FEDER español, con cortes independientes.",
}
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    implementationYear?: string | string[]
    paymentYear?: string | string[]
  }>
}) {
  const params = await searchParams
  const { snapshot, error } = await getCohesionProgrammes()
  const iy = snapshot
    ? selectCohesionYear(
        cohesionYears(snapshot, "implementation"),
        params?.implementationYear,
      )
    : undefined
  const py = snapshot
    ? selectCohesionYear(
        cohesionYears(snapshot, "payments"),
        params?.paymentYear,
      )
    : undefined
  const programmes =
    snapshot?.programmes.filter((p) =>
      p.implementation.some((r) => r.year === iy),
    ) ?? []
  return (
    <div className="ui-page space-y-6">
      <PageHeader
        title="¿En qué fase financiera está cada programa FEDER?"
        description="Coste previsto, operaciones seleccionadas y gasto elegible declarado. Las transferencias de la Comisión al Estado tienen una selección temporal y un perímetro propios; no acreditan pagos a cada proyecto."
      />
      <p className="text-sm leading-6">
        España · FEDER · ciclo 2014–2020. Se conserva el código CCI oficial,
        incluidos códigos históricos que no aparecen en todos los años. No
        incluye FSE, Fondo de Cohesión, FEADER/PAC ni MRR. Kohesio mantiene su
        inventario ESIF separado.
      </p>
      {error ? (
        <p role="alert">
          No se ha podido consultar una edición reconciliada. Un fallo de la
          fuente no significa cero ejecución.
        </p>
      ) : !snapshot ? (
        <p role="status">Todavía no hay una edición disponible.</p>
      ) : (
        <>
          <form
            action="/fondos-ue/cohesion"
            className="flex flex-wrap items-end gap-3"
          >
            <label htmlFor="feder-implementation-year" className="text-sm">
              Año de referencia de implementación
              <select
                id="feder-implementation-year"
                name="implementationYear"
                defaultValue={iy ?? ""}
                className="block rounded border bg-background p-2"
              >
                {iy === undefined && (
                  <option value="" disabled>
                    No disponible
                  </option>
                )}
                {cohesionYears(snapshot, "implementation").map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="feder-payment-year" className="text-sm">
              Año de transferencias acumuladas UE
              <select
                id="feder-payment-year"
                name="paymentYear"
                defaultValue={py ?? ""}
                className="block rounded border bg-background p-2"
              >
                {py === undefined && (
                  <option value="" disabled>
                    No disponible
                  </option>
                )}
                {cohesionYears(snapshot, "payments").map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded border px-3 py-2 text-sm">
              Ver cortes
            </button>
            <Link href="/fondos-ue/cohesion" className="text-sm underline">
              Restablecer consulta
            </Link>
          </form>
          {iy === undefined || py === undefined ? (
            <p role="status">
              Uno de los cortes solicitados no está disponible. No se sustituye
              por otro año.
            </p>
          ) : (
            <>
              <p className="text-sm leading-6">
                {programmes.length} programas con implementación del año de
                referencia {iy}. Su fecha de informe puede ser posterior,
                especialmente en los datos de cierre de 2023. No se presenta un
                total nacional de gasto de programas con fechas de informe
                diferentes.
              </p>
              <div className="space-y-3">
                {programmes.map((p) => {
                  const r = p.implementation.find((r) => r.year === iy)!
                  return (
                    <article
                      key={p.cci}
                      className="space-y-3 rounded border p-4"
                    >
                      <Link
                        href={cohesionHref(p.cci, iy, py)}
                        className="font-semibold underline"
                      >
                        {r.title}
                      </Link>
                      <p className="text-xs font-mono">
                        {p.cci} · informe{" "}
                        {r.reference_date?.slice(0, 10) ??
                          "sin fecha publicada"}
                      </p>
                      <p className="text-sm">
                        Coste previsto UE + nacional:{" "}
                        {cohesionAmount(r, "planned_cents")}.
                      </p>
                      <p className="text-sm">
                        Gasto elegible declarado:{" "}
                        {cohesionAmount(r, "declared_cents")}. No equivale a
                        pago de la Comisión.
                      </p>
                    </article>
                  )
                })}
              </div>
              <Link
                href={cohesionHref(undefined, iy, py)}
                className="text-sm underline"
              >
                Enlace a estos cortes
              </Link>
            </>
          )}
        </>
      )}
      <Link href="/fondos-ue" className="text-sm underline">
        Volver a instrumentos y beneficiarios ESIF
      </Link>
    </div>
  )
}
