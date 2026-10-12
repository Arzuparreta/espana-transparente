import { LawPublication, type LawPublicationResult } from "./LawPublication"
import { parliamentEvidence } from "@/lib/parliament-evidence"
const date=(value:string|null)=>value?new Date(`${value}T12:00:00Z`).toLocaleDateString("es-ES",{timeZone:"Europe/Madrid"}):"No consta en la cobertura disponible"
export function ParliamentEvidence({raw,sourceUrl,publication}:{raw:unknown;sourceUrl?:string|null;publication?:LawPublicationResult}){
 const e=parliamentEvidence(raw)
 const docs=(urls:string[],label:string)=><ul className="space-y-2">{urls.map((url,i)=><li key={url}><a href={url} className="break-words underline underline-offset-4">{label} {i+1} →</a></li>)}</ul>
 return <section className="space-y-4" aria-label="Recorrido parlamentario documentado">
  <h2 className="text-lg font-semibold">¿Qué pasos constan y dónde se pueden comprobar?</h2>
  <p className="text-sm leading-6">Presentar una iniciativa, debatirla, votarla, publicar una ley y que entre en vigor son hechos distintos. Una votación vinculada puede tratar una enmienda o un trámite. «Aprobada» en esta ficha no acredita por sí solo publicación en BOE ni vigencia.</p>
  <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Presentación</dt><dd>{date(e.presentation)}</dd></div><div><dt className="font-semibold">Calificación</dt><dd>{date(e.qualification)}</dd></div></dl>
  {e.committee && <p className="text-sm">Comisión competente: {e.committee}.</p>}
  <div className="space-y-2"><h3 className="font-semibold">Tramitación según el expediente</h3>{e.stages?<p className="whitespace-pre-wrap break-words text-sm leading-6">{e.stages}</p>:<p className="text-sm text-muted-foreground">No hay secuencia de trámites incorporada. Consulta el expediente oficial; la ausencia no significa que no se tramitara.</p>}</div>
  {e.rapporteurs && <details className="text-sm leading-6"><summary className="cursor-pointer underline">Ponentes registrados en el expediente</summary><p className="mt-2 whitespace-pre-wrap break-words">{e.rapporteurs}</p><p className="text-muted-foreground">La ponencia es un rol documentado; no convierte a cada ponente en autor individual de la iniciativa ni de todas sus enmiendas.</p></details>}
  <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><h3 className="font-semibold">Propuesta y boletines</h3>{e.bulletins.length?docs(e.bulletins,"Boletín oficial"): <p className="text-sm text-muted-foreground">Sin boletines enlazados en el registro.</p>}</div><div className="space-y-2"><h3 className="font-semibold">Debate y diarios de sesiones</h3>{e.debates.length?docs(e.debates,"Diario de sesiones"):<p className="text-sm text-muted-foreground">Sin diarios enlazados en el registro. No se infiere ausencia de debate.</p>}</div></div>
  <div className="space-y-2"><h3 className="font-semibold">Publicación y vigencia</h3>{publication?<LawPublication result={publication}/>:e.laws.length?docs(e.laws,"Publicación oficial"): <p className="text-sm text-muted-foreground">No hay publicación en BOE vinculada en la cobertura disponible. El estado de tramitación no sustituye ese documento.</p>}<p className="text-sm leading-6">La entrada en vigor debe comprobarse en el texto publicado y sus disposiciones. No se calcula desde la fecha de votación ni se presume vigente por su aprobación.</p></div>
  {sourceUrl && <a href={sourceUrl} className="block text-sm underline underline-offset-4">Expediente oficial: fechas, proponentes y tramitación →</a>}
 </section>
}
