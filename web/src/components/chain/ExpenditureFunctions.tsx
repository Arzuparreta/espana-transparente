import Link from "next/link"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import {
  COFOG_FUNCTIONS,
  COFOG_SOURCE,
  selectCofogYear,
  type CofogCode,
  type CofogYear,
} from "@/lib/cofog"
import { formatEuroCompact } from "@/lib/format"

export interface ExpenditureFunctionsData {
  years: CofogYear[]
  rejectedYears: number[]
  error: boolean
}
export function ExpenditureFunctions({
  data,
  year,
}: {
  data: ExpenditureFunctionsData
  year?: string | string[]
}) {
  const selected = selectCofogYear(data.years, year)
  const latest = data.years.at(-1)
  return (
    <section className="space-y-5" aria-labelledby="cofog-title">
      <h2 id="cofog-title" className="text-xl font-semibold">
        ¿En qué se gastó?
      </h2>
      <p className="text-sm leading-6 text-muted-foreground">
        España · conjunto de administraciones públicas (S13) · gasto realizado
        en contabilidad nacional, en euros corrientes. Las diez funciones COFOG
        describen el destino del gasto, no ministerios ni personas. No son
        presupuestos autorizados ni pagos de caja.
        {" "}
        <a href={COFOG_SOURCE} className="underline underline-offset-2">
          Fuente: Eurostat · gasto por funciones
        </a>
        .
      </p>
      {data.error ? (
        <p role="alert">
          No se ha podido consultar el gasto por funciones. No se sustituye por
          una suma de contratos ni por presupuestos.
        </p>
      ) : !selected ? (
        <div className="space-y-2" role="status">
          <p>
            {year !== undefined
              ? "El ejercicio solicitado no tiene un reparto completo y reconciliado disponible."
              : "Todavía no hay un reparto completo y reconciliado disponible."}{" "}
            La ausencia de datos no significa gasto cero.
          </p>
          {latest && (
            <Link
              className="underline underline-offset-4"
              href={`/gasto-por-funciones?year=${latest.year}`}
            >
              Consultar el último reparto disponible: {latest.year} →
            </Link>
          )}
        </div>
      ) : (
        <>
          <form
            action="/gasto-por-funciones"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="space-y-1 text-sm">
              Año del gasto
              <select
                name="year"
                defaultValue={selected.year}
                className="ml-2 rounded border border-border bg-background p-2 font-mono"
              >
                {data.years
                  .slice()
                  .reverse()
                  .map((row) => (
                    <option key={row.year} value={row.year}>
                      {row.year}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="rounded border border-border px-3 py-2 text-sm"
              type="submit"
            >
              Consultar
            </button>
          </form>
          <p className="text-lg font-semibold">
            Gasto total {selected.year}:{" "}
            <span className="font-mono">
              {formatEuroCompact(selected.total * 1_000_000)}
            </span>
          </p>
          {selected.provisional && (
            <p className="text-sm">
              Datos provisionales según Eurostat; sujetos a revisión.
            </p>
          )}
          {selected.total === 0 && (
            <p role="status">
              El total publicado es cero. No se calcula un reparto por cada 100
              €.
            </p>
          )}
          <table className="w-full table-fixed text-left text-sm">
            <caption className="pb-3 text-left text-xs leading-5 text-muted-foreground">
              COFOG nivel I · {selected.year}. De cada 100 € de gasto total,
              cuánto corresponde a cada función. Los redondeos pueden impedir
              que las cifras visibles sumen exactamente 100 €.
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="w-1/2 py-2">
                  Función
                </th>
                <th scope="col" className="px-2 py-2">
                  Importe
                </th>
                <th scope="col" className="py-2">
                  De cada 100 €
                </th>
              </tr>
            </thead>
            <tbody>
              {(
                Object.entries(COFOG_FUNCTIONS) as [
                  CofogCode,
                  (typeof COFOG_FUNCTIONS)[CofogCode],
                ][]
              )
                .sort(([a], [b]) => selected.values[b] - selected.values[a])
                .map(([code, fn]) => (
                  <tr
                    key={code}
                    className="border-b border-border/60 align-top"
                  >
                    <th scope="row" className="py-3 pr-2 font-normal">
                      <span className="block font-medium">{fn.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {code}
                      </span>
                      <details className="mt-1 text-xs leading-5 text-muted-foreground">
                        <summary className="cursor-pointer underline underline-offset-2">
                          Qué incluye
                        </summary>
                        {fn.detail}
                      </details>
                    </th>
                    <td className="break-words px-2 py-3 font-mono">
                      {formatEuroCompact(selected.values[code] * 1_000_000)}
                    </td>
                    <td className="py-3 font-mono">
                      {selected.total > 0
                        ? `${((100 * selected.values[code]) / selected.total).toLocaleString("es-ES", { maximumFractionDigits: 1 })} €`
                        : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="text-xs leading-5 text-muted-foreground">
            Las diez funciones reparten el gasto total del mismo año. Protección
            social no son solo pensiones; los intereses están incluidos en servicios
            públicos generales.
          </p>
          <Link
            className="inline-block text-sm underline underline-offset-4"
            href={`/cuentas-publicas?desde=${selected.year}&hasta=${selected.year}`}
          >
            Ver ingresos, déficit y deuda de {selected.year} →
          </Link>
        </>
      )}
      {data.rejectedYears.length > 0 && (
        <p role="status" className="text-sm">
          Repartos excluidos por datos incompletos o inconsistentes:{" "}
          <span className="font-mono">{data.rejectedYears.join(", ")}</span>. No
          se presentan como gasto cero ni como «sin clasificar».
        </p>
      )}
      <SourceFootnote
        sourceLabel="Eurostat · gov_10a_exp · TE · ES · S13 · MIO_EUR"
        sourceHref={COFOG_SOURCE}
        lastChecked={selected?.lastChecked ?? null}
        coverageLabel={
          data.years.length
            ? `${data.years[0].year}–${latest?.year} · ${data.years.length} ejercicios completos`
            : "Sin ejercicios completos disponibles"
        }
      />
      <p className="text-sm leading-6 text-muted-foreground">
        La suma utiliza el agregado S13 publicado; no añade transferencias entre
        administraciones ni suma subsectores. Este reparto no indica cuánto
        recibió tu territorio ni demuestra la calidad de un servicio.{" "}
        <a
          className="underline"
          href="https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_exp_esms.htm"
        >
          Metodología COFOG
        </a>
        .
      </p>
    </section>
  )
}
