import Link from "next/link"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { BDNS_SOURCE, type PurposeGroup } from "@/lib/subsidy-purpose"
import { formatEuroCompact } from "@/lib/format"

export function SubsidyPurposes({
  year,
  groups,
  error,
}: {
  year: number | null
  groups: PurposeGroup[]
  error: boolean
}) {
  const instruments = [...new Set(groups.map((r) => r.instrumento))]
  const total = groups.reduce((n, r) => n + r.grant_count, 0)
  const classified = groups
    .filter((r) => r.classification === "classified")
    .reduce((n, r) => n + r.grant_count, 0)
  const checked = groups
    .filter((r) => r.last_checked)
    .map((r) => r.last_checked!)
    .sort()[0]
  return (
    <section className="space-y-5" aria-label="Finalidades de las ayudas">
      <p className="text-sm leading-6 text-muted-foreground">
        Concesiones recopiladas por el portal, por fecha de concesión. La finalidad declarada pertenece a la convocatoria BDNS
        vinculada por su código; no se deduce del nombre del beneficiario ni del
        título. Concesión no equivale a pago.
      </p>
      <form
        action="/ayudas-por-finalidad"
        className="flex flex-wrap items-end gap-3"
      >
        <label className="text-sm">
          Año de concesión{" "}
          <input
            type="number"
            name="year"
            min="2014"
            max="2100"
            required
            defaultValue={year ?? ""}
            className="ml-2 w-24 rounded border border-border bg-background p-2 font-mono"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-border px-3 py-2 text-sm"
        >
          Consultar
        </button>
      </form>
      {year === null ? (
        <p role="status">
          El año solicitado no es válido. Introduce un ejercicio entre 2014 y
          2100.
        </p>
      ) : error ? (
        <p role="alert">
          No se ha podido consultar el reparto. El error no significa que no se
          concedieran ayudas.
        </p>
      ) : !total ? (
        <p role="status">
          No hay concesiones recopiladas para {year}. No significa que no
          existieran ayudas.
        </p>
      ) : (
        <>
          <p className="text-lg font-semibold">
            {classified.toLocaleString("es-ES")} de{" "}
            {total.toLocaleString("es-ES")} concesiones de {year} tienen
            finalidad verificada.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Importes en euros nominales del registro, separados por instrumento.
            Un préstamo, una garantía y una subvención tienen significados
            distintos: no se suman entre sí. No se añaden presupuestos de
            convocatorias ni importes de otros años.
          </p>
          {instruments.map((instrument) => (
            <section key={instrument ?? "unknown"} className="space-y-3">
              <h2 className="break-words text-base font-semibold">
                {instrument ?? "Instrumento no publicado"}
              </h2>
              <table className="w-full table-fixed text-left text-sm">
                <caption className="pb-2 text-left text-xs text-muted-foreground">
                  Concesiones recopiladas · {year} · por finalidad declarada
                </caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className="w-1/2 py-2">
                      Finalidad
                    </th>
                    <th scope="col" className="px-2 py-2">
                      Registros
                    </th>
                    <th scope="col" className="py-2">
                      Importe registrado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups
                    .filter((r) => r.instrumento === instrument)
                    .map((row) => (
                      <tr
                        key={`${row.classification}:${row.finalidad}`}
                        className="border-b border-border/60 align-top"
                      >
                        <th
                          scope="row"
                          className="break-words py-3 pr-2 font-normal"
                        >
                          {row.finalidad ??
                            (row.classification === "pending"
                              ? "Sin convocatoria verificada"
                              : "Finalidad no publicada")}
                        </th>
                        <td className="px-2 py-3 font-mono">
                          {row.grant_count.toLocaleString("es-ES")}
                        </td>
                        <td className="break-words py-3 font-mono">
                          {row.instrumento === null
                            ? "No comparable sin instrumento"
                            : row.known_amount === null
                              ? "Desconocido"
                              : formatEuroCompact(row.known_amount)}
                          {row.unknown_amount_count +
                            row.negative_amount_count >
                            0 && (
                            <p className="mt-1 font-sans text-xs leading-5">
                              Suma parcial: {row.unknown_amount_count} sin
                              importe válido y {row.negative_amount_count}{" "}
                              negativos excluidos.
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
      <SourceFootnote
        sourceLabel="BDNS · IGAE · concesiones y convocatorias"
        sourceHref={BDNS_SOURCE}
        lastChecked={checked ?? null}
        coverageLabel={`Corpus del portal · año de concesión ${year ?? "no válido"} · verificación parcial de convocatorias`}
      />
      <p className="text-sm leading-6 text-muted-foreground">
        La verificación de convocatorias se amplía progresivamente. Las
        concesiones sin vínculo verificado permanecen visibles; no se
        reclasifican como cero. El corpus excluye etiquetas ausentes o que empiezan
        por asterisco; una etiqueta visible no acredita personalidad jurídica.
        No representa todas las ayudas a hogares y puede tener cobertura temporal
        e importes incompletos. La finalidad no
        acredita resultados del servicio ni dónde se usó el dinero.
      </p>
      <Link
        href={year ? `/subvenciones?year=${year}` : "/subvenciones"}
        className="inline-block text-sm underline underline-offset-4"
      >
        Consultar las concesiones y sus fichas →
      </Link>
    </section>
  )
}
