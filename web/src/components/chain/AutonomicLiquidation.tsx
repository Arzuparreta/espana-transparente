import Link from "next/link";
import { SourceFootnote } from "@/components/domain/SourceFootnote";
import {
  REGIONS,
  CHAPTERS,
  LIQUIDATION_SOURCE,
  selectLiquidation,
  executionRatio,
  type Liquidation,
} from "@/lib/autonomic-liquidation";
import type { Chapter } from "@/lib/budget-execution";
import { formatEuroCompact } from "@/lib/format";
const money = (n: number | null) =>
  n === null ? "No numérico en fuente" : formatEuroCompact(n * 1000);
const percent = (n: number | null) =>
  n === null
    ? "No calculable"
    : `${n.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`;
export function AutonomicLiquidation({
  data,
  year,
  territory,
}: {
  data: { regions: Liquidation[]; rejected: string[]; error: boolean };
  year?: string | string[];
  territory?: string | string[];
}) {
  const { available, selected } = selectLiquidation(
    data.regions,
    year,
    territory,
  );
  const rows = selected
    ? Object.keys(CHAPTERS).map((c) => ({
        label: CHAPTERS[c as Chapter],
        values: selected.rows[c as Chapter],
        code: c,
      }))
    : data.regions.map((r) => ({
        label: REGIONS[r.territory].name,
        values: r.rows.NF,
        code: r.territory,
        region: r,
      }));
  return (
    <section
      className="space-y-5"
      aria-label="Liquidación presupuestaria autonómica"
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Hacienda · liquidación definitiva de 2024 · datos presupuestarios
        consolidados de cada comunidad, administración general y entidades
        incluidas por la fuente. Las transferencias internas se eliminan en la
        consolidación. No es todo el gasto realizado dentro de ese territorio:
        no incluye por sí solo Estado, ayuntamientos ni todos los entes del
        sector público.
      </p>
      <p className="text-sm leading-6">
        Las competencias y los sistemas de financiación difieren. Navarra y País
        Vasco tienen régimen foral; Canarias presenta particularidades fiscales.
        Comparar importes no mide eficiencia ni cuánto recibe una persona. Ceuta
        y Melilla quedan fuera de este piloto de 17 comunidades. No sumes estas
        cuentas al presupuesto del Estado: las transferencias entre
        administraciones podrían contarse dos veces.
      </p>
      {data.error ? (
        <p role="alert">
          No se ha podido consultar la liquidación autonómica. El error no se
          presenta como gasto cero.
        </p>
      ) : !available ? (
        <div role="status">
          <p>
            El ejercicio o territorio solicitado no tiene una comparación
            completa validada disponible. La ausencia no significa gasto cero.
          </p>
          <Link
            href="/liquidacion-autonomica?year=2024&territory=all"
            className="underline underline-offset-4"
          >
            Consultar la cobertura de 2024 →
          </Link>
        </div>
      ) : (
        <>
          <form
            action="/liquidacion-autonomica"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">
              Ejercicio{" "}
              <select
                name="year"
                defaultValue="2024"
                className="rounded border border-border bg-background p-2"
              >
                <option>2024</option>
              </select>
            </label>
            <label className="min-w-0 text-sm">
              Administración{" "}
              <select
                name="territory"
                defaultValue={selected?.territory ?? "all"}
                className="max-w-full rounded border border-border bg-background p-2"
              >
                <option value="all">17 comunidades</option>
                {data.regions.map((r) => (
                  <option key={r.territory} value={r.territory}>
                    {REGIONS[r.territory].name}
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
          <h2 className="text-xl font-semibold">
            {selected
              ? REGIONS[selected.territory].name
              : "17 comunidades autónomas"}{" "}
            · ejercicio 2024
          </h2>
          <p className="text-sm leading-6">
            Crédito inicial: autorización de partida. Crédito definitivo:
            autorización tras modificaciones. Obligación reconocida neta:
            importe registrado como obligación presupuestaria. Pago líquido:
            pago registrado en esta liquidación del ejercicio. Son fases
            distintas y no se suman. No se equiparan a la serie mensual estatal
            ni a contabilidad nacional.
          </p>
          {selected && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded border border-border p-4">
                <p>Obligaciones / crédito definitivo · capítulos 1–7</p>
                <p className="font-mono text-2xl">
                  {percent(
                    executionRatio(
                      selected.rows.NF.obligations,
                      selected.rows.NF.credit,
                    ),
                  )}
                </p>
                <p className="text-sm">
                  {money(selected.rows.NF.obligations)} sobre{" "}
                  {money(selected.rows.NF.credit)}.
                </p>
              </div>
              <div className="rounded border border-border p-4">
                <p>Pagos líquidos / obligaciones · capítulos 1–7</p>
                <p className="font-mono text-2xl">
                  {percent(
                    executionRatio(
                      selected.rows.NF.payments,
                      selected.rows.NF.obligations,
                    ),
                  )}
                </p>
                <p className="text-sm">
                  {money(selected.rows.NF.payments)} sobre{" "}
                  {money(selected.rows.NF.obligations)}.
                </p>
              </div>
            </div>
          )}
          <table className="w-full table-fixed text-left text-sm">
            <caption className="pb-3 text-left text-xs leading-5 text-muted-foreground">
              {selected
                ? "Capítulos presupuestarios y subtotales, sin sumarlos de nuevo"
                : "Operaciones no financieras (capítulos 1–7) de cada comunidad, sin total agregado"}{" "}
              · euros corrientes · liquidación definitiva 2024. Crédito inicial
              disponible en cada fila.
            </caption>
            <thead>
              <tr className="border-b border-border text-xs sm:text-sm">
                <th className="w-2/5 py-2" scope="col">
                  {selected ? "Capítulo" : "Administración / fuente"}
                </th>
                <th className="break-words px-1" scope="col">
                  Crédito definitivo
                </th>
                <th className="break-words px-1" scope="col">
                  Obligación neta
                </th>
                <th className="break-words px-1" scope="col">
                  Pago líquido
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.code}
                  className="border-b border-border/60 align-top"
                >
                  <th scope="row" className="py-3 pr-2 font-normal">
                    {"region" in r && r.region ? (
                      <>
                        <Link
                          href={`/liquidacion-autonomica?year=2024&territory=${r.code}`}
                          className="block underline underline-offset-4"
                        >
                          {r.label}
                        </Link>
                        <a
                          href={LIQUIDATION_SOURCE}
                          className="text-xs underline"
                          aria-label={`Fuente Hacienda ${r.label}`}
                        >
                          Hacienda ↗
                        </a>
                      </>
                    ) : (
                      r.label
                    )}
                    <details className="mt-1 text-xs leading-5 text-muted-foreground">
                      <summary className="cursor-pointer underline">
                        Crédito inicial
                      </summary>
                      {money(r.values.initial)}
                    </details>
                  </th>
                  {(["credit", "obligations", "payments"] as const).map((f) => (
                    <td key={f} className="break-words px-1 py-3 font-mono">
                      {money(r.values[f])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm leading-6 text-muted-foreground">
            Capítulos 8–9: operaciones financieras; devolver principal de deuda
            no es pagar intereses. Total presupuestario (1–9) y subtotal no
            financiero (1–7) no se suman. Los valores no numéricos de la fuente
            se conservan; no se infieren ceros. Se usa la descarga «Ingresos y
            Gastos por capítulos», sin aplicar una depuración propia de IFL/PAC.
          </p>
          {selected && (
            <Link
              className="underline underline-offset-4"
              href="/liquidacion-autonomica?year=2024&territory=all"
            >
              Volver a las 17 comunidades →
            </Link>
          )}
        </>
      )}
      {data.rejected.length > 0 && (
        <p role="status">
          Comparación retenida por administraciones ausentes o inconsistentes:{" "}
          {data.rejected
            .map((k) =>
              Object.hasOwn(REGIONS, k)
                ? REGIONS[k as keyof typeof REGIONS].name
                : k,
            )
            .join(", ")}
          .
        </p>
      )}
      <SourceFootnote
        sourceLabel="Hacienda · liquidación definitiva consolidada · miles de euros en origen"
        sourceHref={LIQUIDATION_SOURCE}
        lastChecked={
          selected?.lastChecked ??
          (data.regions.every((r) => r.lastChecked)
            ? (data.regions.map((r) => r.lastChecked!).sort()[0] ?? null)
            : null)
        }
        coverageLabel={
          data.error
            ? "Cobertura no consultable"
            : `${data.regions.length} de 17 comunidades · 2024`
        }
      />
      <p className="text-sm leading-6 text-muted-foreground">
        Para reproducir la cifra en Hacienda: Datos definitivos → Datos
        consolidados → Descargas en Excel → ejercicio 2024 →{" "}
        {selected
          ? REGIONS[selected.territory].name
          : "la comunidad de la fila"}{" "}
        → Ingresos y Gastos por capítulos. La descarga requiere iniciar la
        consulta en su portal; el enlace de fuente lleva a esa entrada estable.
      </p>
      <a
        href={LIQUIDATION_SOURCE}
        className="block text-sm underline underline-offset-4"
      >
        Publicación, notas metodológicas y entidades incluidas en Hacienda →
      </a>
    </section>
  );
}
