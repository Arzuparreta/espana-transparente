import type { Responsibility } from "@/lib/data/shared"
const METHODS:Record<string,string>={direct_department:"Coincidencia directa de departamento",position_alias:"Alias del cargo y órgano",curated_body_map:"Correspondencia documentada de órgano",autonomic_president_baseline:"Referencia a presidencia autonómica",municipal_mayor_baseline:"Referencia a alcaldía",body_alias:"Correspondencia de órgano",state_department:"Correspondencia de departamento"}
const date=(value?:string|null)=>value?new Date(`${value.slice(0,10)}T12:00:00Z`).toLocaleDateString("es-ES",{timeZone:"Europe/Madrid"}):"No registrada"
export function MandateEvidence({responsible,recordSource}:{responsible:Responsibility|null;recordSource?:string|null}){
 return <section className="space-y-3 rounded-[2px] border border-border p-4 text-sm leading-6" aria-label="Evidencia de mandato y registro">
  <h3 className="font-semibold">¿Qué acredita este vínculo?</h3>
  {responsible?<>
   <p>Mandato registrado: {date(responsible.start_date)} — {responsible.end_date?date(responsible.end_date):"cese no registrado"}. Un cese ausente no certifica que siga en el cargo hoy.</p>
   <p>Fecha de asociación: {date(responsible.relation_date)} · {responsible.date_basis==="award_date"?"adjudicación registrada":responsible.date_basis==="grant_date"?"concesión registrada":"publicación del registro, sin fecha de adjudicación"}.</p>
   <p>Método: {METHODS[responsible.match_method??""]??"Correspondencia de órgano o ámbito institucional"}. {(responsible.candidate_count??1)>1?`${responsible.candidate_count} mandatos candidatos; se muestra la coincidencia priorizada, no una atribución exclusiva.`:"Mandato seleccionado por la asociación del registro."}</p>
   {responsible.mandate_source_url?<a href={responsible.mandate_source_url} className="block underline underline-offset-4">Documento que respalda el cargo →</a>:<p>Documento del cargo no disponible en el registro.</p>}
   {responsible.position_id && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer underline">Identificador del mandato</summary><span className="break-all font-mono">{responsible.position_id}</span></details>}
  </>:<p>No hay un mandato asociado en la cobertura disponible. Eso no significa que no existiera un cargo competente.</p>}
  <p>La coincidencia de órgano y fecha no acredita una firma, orden o intervención personal. La actuación visible en este registro y el nombramiento del cargo son evidencias distintas.</p>
  {recordSource?<a href={recordSource} className="block underline underline-offset-4">Consultar el registro y sus documentos de actuación →</a>:<p>Documento de la actuación no disponible en este registro.</p>}
 </section>
}
