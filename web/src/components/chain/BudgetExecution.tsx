import Link from "next/link"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import {
  CHAPTERS,
  EXECUTION_SOURCE,
  executionRatio,
  selectExecutionPeriod,
  type Chapter,
  type ExecutionPeriod,
} from "@/lib/budget-execution"
import { formatEuroCompact } from "@/lib/format"

const money = (n: number | null) =>
  n === null ? "No numérico en fuente" : formatEuroCompact(n * 1000)
const percent = (n: number | null) =>
  n === null
    ? "No calculable"
    : `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`
export function BudgetExecution({
  data,
  period,
}: {
  data: {
    periods: ExecutionPeriod[]
    rejectedPeriods: string[]
    error: boolean
  }
  period?: string | string[]
}) {
  const selected = selectExecutionPeriod(data.periods, period),
    latest = data.periods.at(-1)
  const nf = selected?.rows.NF
  const table = (codes: Chapter[], caption: string) =>
    selected && (
      <table className="w-full table-fixed text-left text-sm">
        <caption className="pb-3 text-left text-xs leading-5 text-muted-foreground">
          {caption}. Euros corrientes · créditos vigentes al corte; obligaciones
          y pagos acumulados del ejercicio.
        </caption>
        <thead>
          <tr className="border-b border-border text-xs sm:text-sm">
            <th scope="col" className="w-2/5 py-2">
              Capítulo
            </th>
            <th scope="col" className="break-words px-1 py-2">
              Crédito definitivo
            </th>
            <th scope="col" className="break-words px-1 py-2">
              Obligación neta
            </th>
            <th scope="col" className="break-words px-1 py-2">
              Pago corriente
            </th>
          </tr>
        </thead>
        <tbody>
          {codes.map((code) => (
            <tr key={code} className="border-b border-border/60 align-top">
              <th scope="row" className="py-3 pr-2 font-normal">
                <span className="block font-medium">{CHAPTERS[code]}</span>
                <details className="mt-1 text-xs leading-5 text-muted-foreground">
                  <summary className="cursor-pointer underline underline-offset-2">
                    Gasto comprometido
                  </summary>
                  {money(selected.rows[code].committed)}
                </details>
              </th>
              {(["credit", "obligations", "payments"] as const).map((f) => (
                <td key={f} className="break-words px-1 py-3 font-mono">
                  {money(selected.rows[code][f])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  return (
    <section
      className="space-y-5"
      aria-label="Ejecución del presupuesto del Estado"
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Presupuesto de gastos del Estado · IGAE · pagos aplicados al presupuesto
        corriente. Este ámbito no es todo el gasto público ni el conjunto S13:
        no incluye las cuentas autonómicas y locales. Las transferencias están
        incluidas en el presupuesto publicado; no se vuelven a sumar con sus
        receptores.
      </p>
      {data.error ? (
        <p role="alert">
          No se ha podido consultar la ejecución presupuestaria. El error no se
          presenta como gasto cero.
        </p>
      ) : !selected ? (
        <div role="status" className="space-y-2">
          <p>
            {period === undefined
              ? "Todavía no hay un informe validado disponible."
              : "El periodo solicitado no tiene un informe validado disponible."}{" "}
            La ausencia no significa que no se ejecutara gasto.
          </p>
          {latest && (
            <Link
              className="underline underline-offset-4"
              href={`/ejecucion-presupuestaria?period=${latest.period}`}
            >
              Consultar el informe disponible: {latest.period} →
            </Link>
          )}
        </div>
      ) : (
        <>
          <form
            action="/ejecucion-presupuestaria"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">
              Corte del informe{" "}
              <select
                name="period"
                defaultValue={selected.period}
                className="ml-2 rounded border border-border bg-background p-2 font-mono"
              >
                {data.periods
                  .slice()
                  .reverse()
                  .map((r) => (
                    <option key={r.period} value={r.period}>
                      {r.period}
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
          <h2 className="text-xl font-semibold">
            Acumulado enero–
            {new Date(`${selected.period}-01T12:00:00Z`).toLocaleDateString(
              "es-ES",
              { month: "long", year: "numeric", timeZone: "Europe/Madrid" },
            )}
          </h2>
          <p className="text-sm leading-6">
            Es un informe mensual acumulado, no el gasto de ese mes ni una
            liquidación definitiva. Los créditos definitivos incorporan
            modificaciones; no son los créditos iniciales ni un nuevo
            presupuesto aprobado.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border border-border p-4">
              <p className="text-sm">
                Obligaciones / crédito definitivo · capítulos 1–7
              </p>
              <p className="mt-2 font-mono text-2xl">
                {percent(executionRatio(nf!.obligations, nf!.credit))}
              </p>
              <p className="mt-2 text-sm leading-6">
                {money(nf!.obligations)} en obligaciones reconocidas netas sobre{" "}
                {money(nf!.credit)} de crédito definitivo.
              </p>
            </div>
            <div className="rounded border border-border p-4">
              <p className="text-sm">
                Pagos corrientes / obligaciones · capítulos 1–7
              </p>
              <p className="mt-2 font-mono text-2xl">
                {percent(executionRatio(nf!.payments, nf!.obligations))}
              </p>
              <p className="mt-2 text-sm leading-6">
                {money(nf!.payments)} pagados con cargo al presupuesto
                corriente. No incluye pagos de ejercicios cerrados.
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Crédito: autorización vigente. Compromiso: gasto comprometido.
            Obligación reconocida: obligación presupuestaria registrada. Pago:
            salida aplicada al presupuesto corriente. Son etapas distintas, no
            importes que deban sumarse.
          </p>
          {table(
            ["1", "2", "3", "4", "5", "6", "7", "NF"],
            "Operaciones no financieras",
          )}
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">
              Operaciones financieras y total presupuestario
            </summary>
            <p className="py-3 text-sm leading-6">
              Los capítulos 8 y 9 incluyen activos financieros y pasivos
              financieros, como devoluciones del principal de deuda. El total
              presupuestario no equivale al gasto de contabilidad nacional. No
              se añade al total no financiero como si fuese otra categoría.
            </p>
            {table(
              ["8", "9", "FIN", "TOTAL"],
              "Operaciones financieras y total",
            )}
          </details>
          <p className="text-sm leading-6 text-muted-foreground">
            Los guiones del libro se conservan como «no numérico en fuente»; no
            se infieren ceros ni porcentajes. Estos datos no acreditan la
            calidad de servicios, una decisión personal o cuánto llegó a tu
            territorio.
          </p>
        </>
      )}
      {data.rejectedPeriods.length > 0 && (
        <p role="status">
          Informes excluidos por datos incompletos o inconsistentes:{" "}
          {data.rejectedPeriods.join(", ")}.
        </p>
      )}
      <SourceFootnote
        sourceLabel="IGAE · Estado · GTOS 004 / GTOS 013 · miles de euros en origen"
        sourceHref={selected?.sourceUrl ?? EXECUTION_SOURCE}
        lastChecked={selected?.lastChecked ?? null}
        coverageLabel={
          data.error
            ? "Cobertura no consultable"
            : data.periods.length
              ? `${data.periods.length} informe${data.periods.length === 1 ? "" : "s"} acumulado${data.periods.length === 1 ? "" : "s"} · piloto ${data.periods[0].period}${data.periods.length > 1 ? `–${latest?.period}` : ""}`
              : "Sin informes completos disponibles"
        }
      />
      <p className="text-sm">
        <a href={EXECUTION_SOURCE} className="underline underline-offset-4">
          Publicación y cuadros originales IGAE →
        </a>
      </p>
    </section>
  )
}
