import Link from "next/link"
import { SourceFootnote } from "./SourceFootnote"
import type { ActivityCoverage, ActivityRow } from "@/lib/parliament-activity"
export function DecisionAnswer({ data }: { data: { coverage: ActivityCoverage | null; year?: string; rows: ActivityRow[]; error: boolean } }) {
  const { coverage, year } = data
  const summary = coverage && year ? coverage.years[year] : null
  return <section className="space-y-4" aria-label="Primera respuesta sobre decisiones">
    <h2 className="text-xl font-semibold">Vivienda: ¿qué actuaciones constan y qué prueban?</h2>
    <p className="text-sm leading-6">Primer tema documentado · Congreso, legislatura XV. La selección busca palabras completas de vivienda, alquiler o hipoteca en títulos publicados. No es una clasificación oficial ni todo lo debatido sobre vivienda.</p>
    {data.error ? <p role="alert">No se ha podido consultar actividad validada. El error no se presenta como cero actuaciones.</p> : !summary || !year || !coverage ? <p role="status">El año solicitado no tiene cobertura validada disponible. No se sustituye por otro año ni acredita falta de actividad.</p> : <>
      <form action="/decisiones" className="flex flex-wrap items-end gap-3">
        <label className="text-sm" htmlFor="decision-year">Año de sesión
          <select id="decision-year" name="year" defaultValue={year} className="block max-w-full rounded border bg-background p-2">{Object.keys(coverage.years).sort().reverse().map(y => <option key={y}>{y}</option>)}</select>
        </label>
        <button className="rounded border px-3 py-2 text-sm">Consultar actuaciones</button>
      </form>
      <h3 className="text-lg font-semibold">Actividad registrada en {year}</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border p-4"><dt>Intervenciones en la selección</dt><dd className="font-mono text-2xl">{summary.interventions.toLocaleString("es-ES")}</dd></div>
        <div className="rounded border p-4"><dt>Registros de votación en esta fuente</dt><dd className="font-mono text-2xl">{summary.voting_records.toLocaleString("es-ES")}</dd></div>
      </dl>
      <p className="text-sm leading-6">La regla selecciona {summary.selected.toLocaleString("es-ES")} de {summary.universe.toLocaleString("es-ES")} registros publicados de ese año. Los restantes no activan la señal en el título; no se califican como ajenos a vivienda. Son registros, no horas de trabajo ni un índice de productividad.</p>
      <h3 className="text-lg font-semibold">Últimos registros de la selección</h3>
      {data.rows.length === 0 ? <p role="status">Esta selección validada no contiene registros del año.</p> : <ul className="space-y-3">{data.rows.slice(0, 3).map(row => <li key={row.id} className="min-w-0 space-y-2 rounded border p-4 text-sm leading-6">
        <p className="font-mono text-xs">{row.event_date} · {row.kind === "intervention" ? "Intervención" : "Registro de votación"}</p>
        <p className="font-semibold break-words">{row.title}</p>
        <p>{row.initiative_type} · expediente {row.initiative_number} · fase publicada: {row.phase ?? "no disponible"}</p>
        <p>Orador registrado: {row.speaker ?? "no identificado"}{row.speaker_role ? ` · ${row.speaker_role}` : ""}. Orador no equivale a proponente.</p>
        {row.documents.length > 0 ? row.documents.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block underline">Documento oficial {index+1}</a>) : <p>Documento no enlazado en este registro.</p>}
      </li>)}</ul>}
      <Link href={`/temas/vivienda?year=${year}`} className="block underline">Todas las actuaciones, personas y documentos de {year} →</Link>
      <Link href={`/decisiones?year=${year}`} className="block text-sm underline">Enlace a esta consulta</Link>
      <SourceFootnote sourceLabel="Congreso · actividad sobre vivienda, selección del portal" sourceHref={coverage.dataset_url} lastChecked={coverage.retrieved_at} coverageLabel={`Legislatura XV · año de sesión ${year} · regla ${coverage.mapping_version} · cobertura parcial`} />
    </>}
    <p className="text-sm leading-6">Una intervención no acredita aprobación de una ley. Un registro de votación aquí no contiene por sí solo el voto nominal. Para seguir una medida, comprueba propuesta, trámite, voto, publicación y vigencia; el portal mantiene los huecos cuando no hay evidencia.</p>
    <div className="flex flex-wrap gap-3 text-sm">
      <Link href="/iniciativas" className="underline">Propuestas, tramitación y norma publicada →</Link>
      <Link href="/votaciones" className="underline">Qué se votó y voto de cada representante →</Link>
      <Link href="/actividad-senado" className="underline">Control sobre vivienda en el Senado, con periodo propio →</Link>
    </div>
  </section>
}
