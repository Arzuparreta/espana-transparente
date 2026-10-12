import { Pagination } from "@/components/domain/Pagination";
import Link from "next/link";
import { SourceFootnote } from "@/components/domain/SourceFootnote";
import {
  ACTIVITY_SOURCE,
  ACTIVITY_VERSION,
  type ActivityRow,
  type ActivityCoverage,
} from "@/lib/parliament-activity";
export function ParliamentActivity({
  data,
  page = 1,
}: {
  page?: number;
  data: {
    coverage: ActivityCoverage | null;
    year?: string;
    rows: ActivityRow[];
    error: boolean;
  };
}) {
  const { coverage, year } = data;
  const summary = year && coverage ? coverage.years[year] : null;
  const totalPages = Math.max(1, Math.ceil(data.rows.length / 30));
  const visible = data.rows.slice((page - 1) * 30, page * 30);
  const types = new Map<string, number>();
  data.rows.forEach((r) =>
    types.set(r.initiative_type, (types.get(r.initiative_type) ?? 0) + 1),
  );
  return (
    <section
      className="space-y-5"
      aria-label="Actividad parlamentaria registrada sobre vivienda"
    >
      <p className="text-sm leading-6">
        Legislatura XV · Congreso · registros cuyo título contiene una palabra
        completa de vivienda, alquiler o hipoteca. Es una selección del portal
        por título, no una clasificación oficial ni todo lo debatido sobre
        vivienda. Cada registro conserva la coincidencia, el rol y su documento.
      </p>
      {data.error ? (
        <p role="alert">
          No se ha podido consultar una actividad reconciliada. El fallo no se
          presenta como cero intervenciones.
        </p>
      ) : !year || !summary ? (
        <p role="status">
          El año solicitado no tiene cobertura validada disponible. No se
          sustituye por otro año ni se interpreta como ausencia de actividad.
        </p>
      ) : (
        <>
          <form
            action="/temas/vivienda"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">
              Año de la sesión{" "}
              <select
                name="year"
                defaultValue={year}
                className="rounded border border-border bg-background p-2"
              >
                {Object.keys(coverage!.years)
                  .sort()
                  .reverse()
                  .map((y) => (
                    <option key={y}>{y}</option>
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
            ¿Qué actividad consta en {year}?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border border-border p-4">
              <p className="font-mono text-2xl">
                {summary.interventions.toLocaleString("es-ES")}
              </p>
              <p>Intervenciones registradas en la selección</p>
            </div>
            <div className="rounded border border-border p-4">
              <p className="font-mono text-2xl">
                {summary.voting_records.toLocaleString("es-ES")}
              </p>
              <p>Registros de votación en esta fuente</p>
            </div>
          </div>
          <p className="text-sm leading-6">
            Son registros de actividad, no horas de debate ni tiempo dedicado
            por una persona. Las votaciones de esta fuente no incluyen por sí
            solas el voto nominal ni prueban una ley aprobada. Una intervención
            no convierte al orador en proponente de la iniciativa.
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Universo de la fuente en {year}:{" "}
            {summary.universe.toLocaleString("es-ES")} registros. La regla
            activa {summary.selected.toLocaleString("es-ES")};{" "}
            {(summary.universe - summary.selected).toLocaleString("es-ES")} no
            activan esa señal en el título y no se califican como ajenos a
            vivienda. Cobertura parcial dentro de la legislatura y del periodo
            publicado, sin comparación de productividad entre años.
          </p>
          <details className="text-sm leading-6">
            <summary className="cursor-pointer font-semibold underline">
              Tipos de iniciativa en esta selección
            </summary>
            <ul className="mt-2 space-y-1">
              {[...types]
                .sort((a, b) => a[0].localeCompare(b[0], "es"))
                .map(([label, n]) => (
                  <li key={label}>
                    {label} · {n} registros
                  </li>
                ))}
            </ul>
          </details>
          <h3 className="text-lg font-semibold">
            Personas, actuaciones y documentos
          </h3>
          {page > totalPages ? (
            <p role="status">
              La página solicitada queda fuera de la cobertura del año.
            </p>
          ) : (
            <ul className="space-y-3">
              {visible.map((r) => (
                <li
                  key={r.id}
                  className="space-y-2 rounded border border-border p-4 text-sm leading-6"
                >
                  <p className="font-mono text-xs text-muted-foreground">
                    {r.event_date} · {r.body ?? "Órgano no registrado"} ·{" "}
                    {r.kind === "intervention"
                      ? "Intervención"
                      : "Registro de votación"}
                  </p>
                  <p className="font-semibold">{r.title}</p>
                  <p>
                    {r.initiative_type} · Exp. {r.initiative_number}
                    {r.phase ? ` · Fase: ${r.phase}` : ""}
                  </p>
                  {r.speaker ? (
                    <p>
                      Orador registrado:{" "}
                      {r.politician_id ? (
                        <Link
                          href={`/diputados/${r.politician_id}`}
                          className="underline"
                        >
                          {r.speaker}
                        </Link>
                      ) : r.official_id ? (
                        <Link
                          href={`/cargos/${r.official_id}`}
                          className="underline"
                        >
                          {r.speaker}
                        </Link>
                      ) : (
                        r.speaker
                      )}
                      {r.speaker_role ? ` · ${r.speaker_role}` : ""}
                      {(r.politician_id || r.official_id) && (
                        <span className="block text-xs text-muted-foreground">
                          Enlace nominal con el registro de persona; el
                          documento conserva la identidad y el rol publicados.
                        </span>
                      )}
                    </p>
                  ) : (
                    <p>
                      Este registro no identifica un orador; no se le asigna una
                      persona.
                    </p>
                  )}
                  {r.proposer_label && (
                    <details>
                      <summary className="cursor-pointer underline">
                        Proponente según la fuente
                      </summary>
                      <p>{r.proposer_label}</p>
                    </details>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Señal del título: «{r.title_signal}» · regla{" "}
                    {ACTIVITY_VERSION}.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {r.documents.map((d, i) => (
                      <a
                        key={d}
                        href={d}
                        className="underline underline-offset-4"
                      >
                        Diario oficial {i + 1} →
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefForPage={(p) => `/temas/vivienda?year=${year}&page=${p}`}
          />
        </>
      )}
      <SourceFootnote
        sourceLabel="Congreso · actividad publicada de la legislatura XV"
        sourceHref={coverage?.dataset_url ?? ACTIVITY_SOURCE}
        lastChecked={coverage?.retrieved_at ?? null}
        coverageLabel={
          coverage
            ? `${coverage.selected} de ${coverage.universe} registros activan la regla de título · XV`
            : "Cobertura no disponible"
        }
      />
    </section>
  );
}
