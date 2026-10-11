import Link from "next/link"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import {
  SECTORS,
  SECTOR_SOURCE,
  selectSectorYear,
  type Sector,
  type SectorYear,
} from "@/lib/fiscal-sectors"
import { formatEuroCompact } from "@/lib/format"
export function FiscalSectors({
  data,
  year,
}: {
  data: { years: SectorYear[]; rejectedYears: number[]; error: boolean }
  year?: string | string[]
}) {
  const selected = selectSectorYear(data.years, year),
    latest = data.years.at(-1)
  return (
    <section className="space-y-5" aria-label="Cuentas por subsector">
      <p className="text-sm leading-6 text-muted-foreground">
        España · contabilidad nacional SEC 2010 · euros corrientes. Ingresos y
        gasto realizado del ejercicio, no presupuestos autorizados ni pagos de
        caja. Cada subsector agrupa unidades públicas con competencias
        distintas; no representa una persona que decide.{" "}
        <a href={SECTOR_SOURCE} className="underline underline-offset-4">
          Fuente: Eurostat · cuentas por sector
        </a>
        .
      </p>
      {data.error ? (
        <p role="alert">
          No se han podido consultar las cuentas por subsector. El error no se
          presenta como cero.
        </p>
      ) : !selected ? (
        <div role="status" className="space-y-2">
          <p>
            {year !== undefined
              ? "El ejercicio solicitado no tiene cuentas completas y reconciliadas disponibles."
              : "Todavía no hay ejercicios completos disponibles."}{" "}
            La ausencia no significa ingreso o gasto cero.
          </p>
          {latest && (
            <Link
              href={`/cuentas-por-subsector?year=${latest.year}`}
              className="underline underline-offset-4"
            >
              Consultar el último ejercicio disponible: {latest.year} →
            </Link>
          )}
        </div>
      ) : (
        <>
          <form
            action="/cuentas-por-subsector"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">
              Ejercicio
              <select
                name="year"
                defaultValue={selected.year}
                className="ml-2 rounded border border-border bg-background p-2 font-mono"
              >
                {data.years
                  .slice()
                  .reverse()
                  .map((y) => (
                    <option key={y.year} value={y.year}>
                      {y.year}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded border border-border px-3 py-2 text-sm"
            >
              Consultar
            </button>
          </form>
          <p className="text-lg font-semibold">Cuentas de {selected.year}</p>
          {selected.provisional && (
            <p className="text-sm">
              Datos provisionales según Eurostat; sujetos a revisión.
            </p>
          )}
          <p className="text-sm leading-6">
            El saldo es ingresos menos gasto: positivo indica superávit y
            negativo déficit. Los ingresos incluyen transferencias recibidas. No
            son solo impuestos propios.
            <strong>
              {" "}
              No sumes ingresos o gastos de los subsectores como si fueran
              partes de S13.
            </strong>{" "}
            Las operaciones entre administraciones se consolidan en el conjunto.
          </p>
          <table className="w-full table-fixed text-left text-sm">
            <caption className="pb-3 text-left text-xs leading-5 text-muted-foreground">
              Mismo año y unidad · los subsectores no son un reparto porcentual
              del total
            </caption>
            <thead>
              <tr className="border-b border-border text-xs sm:text-sm">
                <th scope="col" className="w-2/5 py-2">
                  Ámbito
                </th>
                <th scope="col" className="px-1 py-2">
                  Ingresos
                </th>
                <th scope="col" className="px-1 py-2">
                  Gasto
                </th>
                <th scope="col" className="py-2">
                  Saldo
                </th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(SECTORS) as Sector[]).map((s) => (
                <tr
                  key={s}
                  className={`border-b border-border/60 align-top ${s === "S13" ? "bg-muted/40" : ""}`}
                >
                  <th scope="row" className="py-3 pr-2 font-normal">
                    <span className="block font-medium">
                      {SECTORS[s].label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {s}
                    </span>
                    <details className="mt-1 text-xs leading-5 text-muted-foreground">
                      <summary className="cursor-pointer underline underline-offset-2">
                        Qué incluye
                      </summary>
                      {SECTORS[s].detail}
                    </details>
                  </th>
                  {(["TR", "TE", "B9"] as const).map((i) => (
                    <td key={i} className="break-words px-1 py-3 font-mono">
                      {i === "B9" && selected.values[s][i] > 0 ? "+" : ""}
                      {formatEuroCompact(selected.values[s][i] * 1_000_000)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm leading-6 text-muted-foreground">
            Los saldos de los cuatro subsectores sí se reconcilian con el saldo
            S13. El déficit requiere financiación; no equivale a la variación
            anual de la deuda. Comparar estos ámbitos no mide eficiencia,
            recursos de tu comunidad ni calidad de servicios.
          </p>
          <Link
            href={`/cuentas-publicas?desde=${selected.year}&hasta=${selected.year}`}
            className="inline-block text-sm underline underline-offset-4"
          >
            Ver deuda, intereses y cuentas del conjunto en {selected.year} →
          </Link>
        </>
      )}
      {data.rejectedYears.length > 0 && (
        <p role="status" className="text-sm">
          Ejercicios excluidos por cuentas incompletas o inconsistentes:{" "}
          {data.rejectedYears.join(", ")}.
        </p>
      )}
      <SourceFootnote
        sourceLabel="Eurostat · gov_10a_main · ES · S13/S1311–S1314 · MIO_EUR"
        sourceHref={SECTOR_SOURCE}
        lastChecked={selected?.lastChecked ?? null}
        coverageLabel={
          data.years.length
            ? `${data.years[0].year}–${latest?.year} · ${data.years.length} ejercicios completos`
            : "Sin ejercicios completos disponibles"
        }
      />
      <a
        href="https://ec.europa.eu/eurostat/cache/metadata/en/gov_10a_main_esms.htm"
        className="inline-block text-sm underline underline-offset-4"
      >
        Metodología y revisiones SEC 2010 →
      </a>
    </section>
  )
}
