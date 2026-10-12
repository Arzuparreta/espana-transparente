import Link from "next/link"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { getMrrInstruments } from "@/lib/data/mrr-instruments"
import { MRR_AMENDMENT, MRR_ORIGINAL, AIREF_METHOD, mrrEuro, mrrYear } from "@/lib/mrr-instruments"
export const revalidate = 3600
export const metadata = { title: "MRR · subvenciones y financiación", description: "Qué acredita una concesión de subvención y qué acredita el compromiso de financiación a ICO: instrumentos, anualidades y fuentes." }
export default async function Page({ searchParams }: { searchParams?: Promise<{ year?: string | string[] }> }) {
  const year = mrrYear((await searchParams)?.year)
  const { snapshot, error } = await getMrrInstruments()
  return <div className="ui-page space-y-6">
    <PageHeader title="¿Subvención o financiación? ¿Qué importe está acreditado?" description="Pilotos MRR/PRTR: concesiones DUS 5000 y compromisos de desembolso a ICO. Cada cifra conserva su fase; no forman un total de ejecución del plan." />
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">DUS 5000 · subvenciones concedidas</h2>
      <p className="text-sm leading-6">Las resoluciones IDAE acreditan ayuda concedida por expediente. Su importe no acredita el pago ni que el proyecto esté terminado. El presupuesto del programa tampoco es otro pago que deba sumarse a las concesiones.</p>
      <Link href="/fondos-ue/prtr" className="underline">Consultar proyectos y resoluciones DUS 5000</Link>
    </section>
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">ICO · compromisos de financiación publicados</h2>
      <p className="text-sm leading-6">La tercera adenda, firmada el 31 de diciembre de 2025 y publicada el 16 de enero de 2026, modifica los compromisos de desembolso de la Secretaría de Estado de Economía y Apoyo a la Empresa a ICO. La eficacia exige inscripción en el registro REOICO; esta consulta no acredita esa inscripción.</p>
      <p className="text-sm leading-6">Estos importes no prueban transferencias ejecutadas, operaciones formalizadas, dinero cobrado por empresas ni devoluciones. Una anualidad pasada revisada tampoco prueba ejecución de ese año. Las comisiones de gestión se regulan en otra estipulación y quedan fuera de estas cifras.</p>
      {error ? <p role="alert">No se ha podido consultar una edición validada. Un error no significa ausencia de financiación.</p> : !snapshot ? <p role="status">Todavía no hay una edición validada de estos compromisos.</p> : <>
        <form action="/fondos-ue/prtr/instrumentos" className="flex flex-wrap items-end gap-3">
          <label htmlFor="mrr-year" className="text-sm">Anualidad del compromiso
            <select id="mrr-year" name="year" defaultValue={year ?? ""} className="block max-w-full rounded border bg-background p-2">
              {year === null && <option value="" disabled>Selección no disponible</option>}
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button className="rounded border px-3 py-2 text-sm">Consultar anualidad</button>
        </form>
        {year === null ? <p role="status">La anualidad solicitada no está disponible. No se sustituye por otra consulta.</p> : <>
          <h3 className="text-lg font-semibold">Compromisos {year} · edición publicada en enero de 2026</h3>
          <div className="grid gap-4 sm:grid-cols-2">{snapshot.facilities.map(f => <article key={f.id} className="min-w-0 space-y-2 rounded border p-4">
            <h4 className="font-semibold">{f.label}</h4>
            <p className="font-mono text-xl break-words">{mrrEuro(f.annualities.find(r => r.year === year)!.cents)}</p>
            <p className="text-sm">Compromiso de desembolso a ICO para {year}.</p>
            <p className="text-sm">Total de compromisos 2024–2026: {mrrEuro(f.total_cents)}. Incluye la anualidad seleccionada; no se suman ambos importes.</p>
            <p className="font-mono text-xs break-all">Aplicación {f.account}</p>
            <a href={MRR_AMENDMENT} target="_blank" rel="noopener noreferrer" className="text-sm underline">BOE · estipulación segunda, tabla modificada</a>
          </article>)}</div>
          <p className="text-sm leading-6">Cero es un compromiso publicado de esa anualidad, no prueba de que no se haya desembolsado o financiado nada. Son dos facilidades; quedan fuera otros instrumentos MRR, ampliaciones de capital y cualquier reparto territorial no acreditado.</p>
          <Link href={`/fondos-ue/prtr/instrumentos?year=${year}`} className="text-sm underline">Enlace a esta anualidad</Link>
        </>}
        <h3 className="text-lg font-semibold">Quién firma y con qué representación</h3>
        <ul className="list-disc pl-5 text-sm space-y-2">{snapshot.signatories.map(person => <li key={person.name}>{person.name} · {person.role} · firma de la adenda del 31/12/2025.</li>)}</ul>
        <p className="text-sm leading-6">El documento acredita esa representación y firma; no atribuye a estas personas la aprobación o el pago de cada operación a un destinatario final.</p>
        <SourceFootnote sourceLabel="BOE · tercera adenda ICO, estipulación segunda" sourceHref={MRR_AMENDMENT} lastChecked={snapshot.retrieved_at} coverageLabel="Dos facilidades · compromisos 2024–2026 · publicación 16/01/2026 · inscripción no verificada" />
      </>}
    </section>
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">El préstamo UE a España y el producto final son fases diferentes</h2>
      <p className="text-sm leading-6">El origen en el tramo de préstamos del MRR no convierte cada operación final en un préstamo. La estipulación quinta del convenio original de 2024 contempla mediación financiera, financiación directa de ICO, adquisición de bonos y deuda, e inversiones en capital y cuasicapital a través de fondos gestionados por AXIS. En capital, el propio convenio advierte que no se garantiza la devolución de la inversión.</p>
      <a href={MRR_ORIGINAL} target="_blank" rel="noopener noreferrer" className="text-sm underline">BOE · convenio original, estipulación quinta (instrumentos)</a>
      <p className="text-sm leading-6">Esta descripción documenta las clases de instrumentos del convenio original, no condiciones actuales para solicitar financiación ni importes ejecutados por modalidad. Los importes originales se modifican en adendas y no sustituyen la tabla de compromisos de esta consulta.</p>
    </section>
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">Contraste de fases · metodología AIReF</h2>
      <p className="text-sm leading-6">La metodología del Observatorio PRTR de AIReF, de abril de 2024, identifica contratos formalizados y subvenciones concedidas a partir de plataformas de contratación y la BDNS. Su ámbito son transferencias del PRTR; no es una medida de todos los instrumentos financieros. Esas fases no equivalen a pagos efectivos. Compararlas con compromisos de financiación exige mantener separados el instrumento y la fase; esta página no importa agregados del observatorio como ejecución contable.</p>
      <a href={AIREF_METHOD} target="_blank" rel="noopener noreferrer" className="text-sm underline">AIReF · metodología del Observatorio PRTR (abril de 2024)</a>
    </section>
    <Link href="/fondos-ue" className="text-sm underline">Volver a fondos europeos</Link>
  </div>
}
