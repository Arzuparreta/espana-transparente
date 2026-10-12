import Link from "next/link"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import {
  IMPLEMENTATION_FIELDS,
  PAYMENT_FIELDS,
  COHESION_DATASETS,
  cohesionAmount,
  cohesionHref,
  selectCohesionYear,
  type CohesionSnapshot,
  type CohesionProgramme,
} from "@/lib/cohesion-program"
export function CohesionProgrammeView({
  snapshot,
  programme,
  implementationYear,
  paymentYear,
}: {
  snapshot: CohesionSnapshot
  programme: CohesionProgramme
  implementationYear?: string | string[]
  paymentYear?: string | string[]
}) {
  const iy = selectCohesionYear(
    programme.implementation.map((r) => r.year),
    implementationYear,
  )
  const py = selectCohesionYear(
    programme.payments.map((r) => r.year),
    paymentYear,
  )
  const implementation = programme.implementation.find((r) => r.year === iy),
    payments = programme.payments.find((r) => r.year === py)
  return (
    <div className="space-y-8">
      <form
        action={`/fondos-ue/cohesion/${programme.cci}`}
        className="flex flex-wrap items-end gap-3"
      >
        <label htmlFor="cohesion-implementation" className="text-sm">
          Año de referencia de implementación
          <select
            id="cohesion-implementation"
            name="implementationYear"
            defaultValue={iy ?? ""}
            className="block rounded border bg-background p-2"
          >
            {iy === undefined && (
              <option value="" disabled>
                No disponible
              </option>
            )}
            {programme.implementation.map((p) => (
              <option key={p.year} value={p.year}>
                {p.year}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="cohesion-payments" className="text-sm">
          Año de transferencias acumuladas UE
          <select
            id="cohesion-payments"
            name="paymentYear"
            defaultValue={py ?? ""}
            className="block rounded border bg-background p-2"
          >
            {py === undefined && (
              <option value="" disabled>
                No disponible
              </option>
            )}
            {programme.payments.map((p) => (
              <option key={p.year} value={p.year}>
                {p.year}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded border px-3 py-2 text-sm">Ver cortes</button>
      </form>
      <section
        className="space-y-4"
        aria-labelledby="cohesion-implementation-title"
      >
        <h2
          id="cohesion-implementation-title"
          className="text-xl font-semibold"
        >
          ¿Qué coste se previó, seleccionó y declaró?
        </h2>
        {!implementation ? (
          <p role="status">
            El año de implementación solicitado no está disponible para este
            código. No se sustituye por otro programa o corte.
          </p>
        ) : (
          <>
            <p className="text-sm leading-6">
              {implementation.title} · ciclo FEDER 2014–2020 · año de referencia
              de fuente {implementation.year}. Fecha del informe:{" "}
              {implementation.reference_date?.slice(0, 10) ?? "no publicada"}.
              Versión de programa {implementation.ver}; versión de informe{" "}
              {implementation.ir_last_version ?? "no publicada"}.
            </p>
            <p className="text-sm leading-6">
              El año de referencia 2023 puede incorporar un informe de cierre
              posterior. Estas cifras acumuladas no son gasto anual de la fecha
              del informe. Coste previsto, seleccionado y declarado incluyen UE
              y cofinanciación nacional; no se suman entre sí.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              {Object.entries(IMPLEMENTATION_FIELDS).map(([key, label]) => (
                <div key={key} className="min-w-0 border-t pt-3">
                  <dt className="text-sm font-semibold">{label}</dt>
                  <dd className="mt-2 font-mono text-xl break-words">
                    {cohesionAmount(implementation, key)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm leading-6">
              Coste total previsto = contribución UE + cofinanciación nacional.
              El coste seleccionado corresponde a operaciones elegidas por
              quienes gestionan el programa. El gasto elegible es el declarado
              por los proyectos al programa: no acredita que la Comisión lo haya
              certificado o reembolsado.
            </p>
            <SourceFootnote
              sourceLabel={`Comisión Europea · ${COHESION_DATASETS[0]} · ${implementation.source_rows} filas de prioridad/objetivo/región`}
              sourceHref={snapshot.sources[COHESION_DATASETS[0]].url}
              lastChecked={snapshot.retrieved_at}
              coverageLabel={`Dataset actualizado ${snapshot.sources[COHESION_DATASETS[0]].updated_at.slice(0, 10)}`}
            />
          </>
        )}
      </section>
      <section
        className="space-y-4 rounded border p-4 sm:p-6"
        aria-labelledby="cohesion-payments-title"
      >
        <h2 id="cohesion-payments-title" className="text-xl font-semibold">
          ¿Qué transferencias netas recibió el Estado?
        </h2>
        {!payments ? (
          <p role="status">
            El año de transferencias solicitado no está disponible. No disponer
            del dato no significa cero pagos.
          </p>
        ) : (
          <>
            <p className="text-sm leading-6">
              {payments.title} · acumulado del ciclo 2014–2020 hasta el corte de{" "}
              {payments.year} disponible en la fuente. {payments.year === Number(snapshot.retrieved_at.slice(0,4)) ? "El corte del año en curso sigue abierto; " : "Corte histórico acumulado; "}actualización de dataset{" "}
              {snapshot.sources[COHESION_DATASETS[1]].updated_at.slice(0, 10)}.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              {Object.entries(PAYMENT_FIELDS).map(([key, label]) => (
                <div key={key} className="min-w-0 border-t pt-3">
                  <dt className="text-sm font-semibold">{label}</dt>
                  <dd className="mt-2 font-mono text-xl break-words">
                    {cohesionAmount(payments, key)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm leading-6">
              Prefinanciación neta + pagos intermedios netos = transferencias
              netas publicadas. Los agregados netos ya reflejan compensaciones y
              recuperaciones: no se les añade otra vez la prefinanciación
              inicial. Son transferencias de la Comisión al Estado, no pagos
              identificados al beneficiario final.
            </p>
            <p className="text-sm leading-6">
              La asignación neta UE es otro perímetro que el coste total
              previsto con cofinanciación nacional. No se calcula un porcentaje
              de ejecución entre cifras con esos denominadores distintos.
            </p>
            <SourceFootnote
              sourceLabel={`Comisión Europea · ${COHESION_DATASETS[1]} · ${payments.source_rows} filas por categoría de región`}
              sourceHref={snapshot.sources[COHESION_DATASETS[1]].url}
              lastChecked={snapshot.retrieved_at}
            />
          </>
        )}
      </section>
      <p className="text-sm leading-6">
        No sumar los cortes anuales: cada uno es acumulado. Este programa es
        FEDER/cohesión, no MRR ni PAC; el piloto no identifica si una operación
        concreta se financió mediante subvención o préstamo. Compartir un
        beneficiario con Kohesio o BDNS tampoco prueba que sea la misma
        operación.
      </p>
      <Link
        href={cohesionHref(undefined, iy, py)}
        className="text-sm underline"
      >
        Volver a programas con estos cortes
      </Link>
    </div>
  )
}
