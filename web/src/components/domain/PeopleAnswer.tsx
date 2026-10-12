import Link from "next/link"
import { EntityLink } from "./EntityLink"
import type { GobiernoMember } from "@/lib/data"
export function mandateDocument(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || !["www.boe.es", "boe.es"].includes(url.hostname)) return null
    return /^BOE-[AB]-\d{4}-\d+$/.test(url.searchParams.get("id") ?? "") || url.pathname.startsWith("/eli/es/") ? value : null
  } catch { return null }
}
export function PeopleAnswer({ members, error }: { members: GobiernoMember[]; error: boolean }) {
  return <section className="space-y-4" aria-label="Personas y mandatos documentados">
    <h2 className="text-xl font-semibold">¿Quién ocupa el cargo y dónde se comprueba su mandato?</h2>
    <p className="text-sm leading-6">Estas son las personas y puestos estatales que el portal registra con mandato iniciado y sin fecha de cese. Es una fotografía del registro actual, no la persona responsable de todas las decisiones históricas del departamento. El nombramiento, la competencia legal y la firma de una actuación son evidencias diferentes.</p>
    {error ? <p role="alert">No se han podido consultar los mandatos. El fallo no significa que los puestos estén vacantes.</p> : members.length === 0 ? <p role="status">No hay mandatos disponibles en esta consulta; no acredita ausencia de titulares.</p> : <>
      <p className="text-sm">{members.length.toLocaleString("es-ES")} registros de puesto y mandato · cobertura del portal, no recuento de personas únicas ni de competencias verificadas.</p>
      <div className="grid gap-3 sm:grid-cols-2">{members.map(member => <article key={member.id} className="min-w-0 space-y-2 rounded border p-4 text-sm leading-6">
        <h3 className="font-semibold break-words">{member.organization_name}</h3>
        <p><EntityLink kind={member.official_id ? "official" : "politician"} id={member.official_id ?? member.politician_id} className="underline">{member.person_name}</EntityLink></p>
        <p>Inicio registrado: {member.start_date ?? "fecha no disponible"}. Cese no registrado en esta vista.</p>
        {mandateDocument(member.source_url) ? <a href={mandateDocument(member.source_url)!} target="_blank" rel="noopener noreferrer" className="underline">Documento del mandato</a> : <p>Documento concreto del mandato no disponible; no se completa con una inferencia.</p>}
        <Link href={`/ministerios/${member.id}`} className="block underline">Puesto, periodo y asociaciones documentadas →</Link>
      </article>)}</div>
    </>}
    <div className="rounded border p-4 space-y-3 text-sm leading-6">
      <h3 className="text-lg font-semibold">Representación, competencia y un asunto concreto</h3>
      <p>Tu circunscripción reúne varios representantes; una persona no representa en exclusiva cada municipio. Congreso y Senado tienen funciones distintas. Para atribuir una decisión, sigue el documento y el mandato de esa fecha.</p>
      <ul className="space-y-2">
        <li><Link href="/diputados" className="underline">Elegir circunscripción del Congreso y consultar votos e iniciativas →</Link></li>
        <li><Link href="/senado" className="underline">Consultar representantes y modalidad de elección del Senado →</Link></li>
        <li><Link href="/instituciones" className="underline">Puestos y nombramientos de instituciones →</Link></li>
        <li><Link href="/temas/vivienda" className="underline">Vivienda: actuaciones, personas y documentos con sus periodos →</Link></li>
      </ul>
      <p>El nombre de un ministerio no acredita por sí solo toda la competencia sobre una materia. Coincidir en departamento o beneficiario tampoco prueba que un titular firmó o pagó una operación.</p>
    </div>
  </section>
}
