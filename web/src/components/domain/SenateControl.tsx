import { SourceFootnote } from "@/components/domain/SourceFootnote";
import { Pagination } from "@/components/domain/Pagination";
import {
  SENATE_CONTROL_SOURCE,
  selectSenateYear,
  type SenateControlCoverage,
  type SenateControlRow,
} from "@/lib/senate-control";
export function SenateControl({
  result,
  year,
  page = 1,
}: {
  result: {
    data: { rows: SenateControlRow[]; metadata: SenateControlCoverage } | null;
    error: boolean;
  };
  year?: string | string[];
  page?: number;
}) {
  const m = result.data?.metadata ?? null,
    selected = selectSenateYear(m, year),
    rows =
      result.data?.rows.filter(
        (r) => r.presentation_date?.slice(0, 4) === selected,
      ) ?? [];
  const motions = rows.filter((r) => r.kind === "motion").length,
    interpellations = rows.length - motions,
    totalPages = Math.max(1, Math.ceil(rows.length / 15)),
    visible = rows.slice((page - 1) * 15, page * 15);
  return (
    <section
      className="space-y-5"
      aria-label="Iniciativas de control del Senado sobre vivienda"
    >
      <p className="text-sm leading-6">
        Senado · legislatura XV · mociones e interpelaciones seleccionadas por
        palabras completas de vivienda, alquiler o hipoteca en el título. Esta
        selección no equivale a todo el tema ni a toda la actividad del Senado.
        Las áreas temáticas oficiales se muestran aparte cuando constan.
      </p>
      {result.error ? (
        <p role="alert">
          No se ha podido consultar un conjunto reconciliado. El error no
          significa cero iniciativas.
        </p>
      ) : !selected ? (
        <p role="status">
          El año solicitado no tiene cobertura validada. No se sustituye por
          otro ni se infiere ausencia de actividad.
        </p>
      ) : (
        <>
          <form
            action="/actividad-senado"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">
              Año de presentación{" "}
              <select
                name="year"
                defaultValue={selected}
                className="rounded border border-border bg-background p-2"
              >
                {Object.keys(m!.years)
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
            ¿Qué iniciativas constan presentadas en {selected}?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border border-border p-4">
              <p className="font-mono text-2xl">{motions}</p>
              <p>Mociones de la selección</p>
            </div>
            <div className="rounded border border-border p-4">
              <p className="font-mono text-2xl">{interpellations}</p>
              <p>Interpelaciones de la selección</p>
            </div>
          </div>
          <p className="text-sm leading-6">
            El año es de presentación, no del debate ni de publicación del
            documento. Una moción insta a actuar; no es una ley. Una
            interpelación es control parlamentario. Estos expedientes no se
            suman a los registros de intervención del Congreso ni miden horas o
            productividad de una persona.
          </p>
          {page > totalPages ? (
            <p role="status">La página queda fuera de la cobertura del año.</p>
          ) : (
            <ul className="space-y-4">
              {visible.map((r) => (
                <li
                  key={r.id}
                  className="space-y-3 rounded border border-border p-4 text-sm leading-6"
                >
                  <p className="font-mono text-xs text-muted-foreground">
                    Presentación: {r.presentation_date ?? "No consta"} · Senado
                    XV · Exp. {r.number}
                  </p>
                  <p className="text-xs text-muted-foreground">Objeto publicado por la fuente</p>
                  <p className="font-semibold">{r.title}</p>
                  <p>
                    {r.evidence.official_type} · Situación publicada:{" "}
                    {r.evidence.status ?? "No consta"}.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Señal del título: «{r.evidence.title_signal}» ·{" "}
                    {r.evidence.mapping_version}. Áreas oficiales:{" "}
                    {r.evidence.official_topics.join(" · ") || "No constan"}.
                  </p>
                  <p>
                    Autores según la fuente:{" "}
                    {r.evidence.authors.filter(Boolean).join(" · ") ||
                      "No constan"}
                    . Un grupo proponente no identifica firmantes individuales.
                  </p>
                  <details>
                    <summary className="cursor-pointer font-semibold underline">
                      Trámites, sesiones y personas registrados
                    </summary>
                    <div className="mt-3 space-y-4">
                      <div>
                        <h3 className="font-semibold">Tramitación</h3>
                        {r.evidence.stages.length ? (
                          <ul>
                            {r.evidence.stages.map((s, i) => (
                              <li key={i}>
                                {s.date ?? "Fecha no indicada"} ·{" "}
                                {s.description ?? "Descripción no indicada"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>No hay trámites incorporados en la ficha.</p>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">Sesiones</h3>
                        {r.evidence.sessions.length ? (
                          <ul>
                            {r.evidence.sessions.map((s, i) => (
                              <li key={i}>
                                {s.date ?? "Fecha no indicada"} ·{" "}
                                {s.body ?? "Órgano no indicado"} · sesión{" "}
                                {s.number ?? "sin número"}, convocatoria{" "}
                                {s.convocation ?? "sin número"} ·{" "}
                                {s.state ?? "Estado no indicado"}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>
                            No hay sesiones incorporadas; no se infiere que no
                            hubiera debate.
                          </p>
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          Personas que intervinieron según la ficha
                        </h3>
                        {r.evidence.actors.length ? (
                          <ul>
                            {r.evidence.actors.map((a, i) => (
                              <li key={i}>
                                {a.name ?? "Nombre no indicado"} ·{" "}
                                {a.role ?? "Rol no indicado"} · identificador
                                publicado {a.source_id ?? "no indicado"}. Total
                                de intervenciones que resume la ficha:{" "}
                                {a.registered_total ?? "no indicado"}.
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>
                            No hay intervinientes incorporados; no se inventan
                            identidades.
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          Intervenir no convierte a la persona en autora de la
                          moción ni acredita tiempo dedicado.
                        </p>
                      </div>
                    </div>
                  </details>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={r.evidence.page_url}
                      className="underline underline-offset-4"
                    >
                      Expediente oficial →
                    </a>
                    {r.evidence.documents.map((d, i) => (
                      <a
                        key={d.url + i}
                        href={d.url}
                        className="underline underline-offset-4"
                      >
                        {d.kind === "diary"
                          ? "Diario de sesiones"
                          : d.kind === "bulletin"
                            ? "Boletín oficial"
                            : "Documento BOE"}{" "}
                        {i + 1} →
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
            hrefForPage={(p) => `/actividad-senado?year=${selected}&page=${p}`}
          />
        </>
      )}
      {m && m.undated > 0 && <p role="status">{m.undated} expedientes sin fecha de presentación incorporada no se asignan a un año.</p>}
      <SourceFootnote
        sourceLabel="Senado · catálogos de mociones e interpelaciones y fichas XML"
        sourceHref={SENATE_CONTROL_SOURCE}
        lastChecked={m?.retrieved_at ?? null}
        coverageLabel={
          m
            ? `${m.selected} iniciativas seleccionadas por título de ${Object.values(m.catalogs).reduce((s, c) => s + c.universe, 0)} de estos dos catálogos · XV`
            : "Cobertura no disponible"
        }
      />
      <p className="text-sm text-muted-foreground">
        La publicación de una moción en un boletín no es promulgación ni entrada
        en vigor de una ley. Un documento BOE enlazado debe leerse para
        comprobar qué relación acredita; no se transforma en vigencia de esta
        iniciativa.
      </p>
    </section>
  );
}
