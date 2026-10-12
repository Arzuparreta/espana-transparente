import type {PublishedBill} from '@/lib/law-publication'
export interface LawPublicationResult {bill:PublishedBill|null;checkedAt:string|null;error:boolean}
const date=(value:string)=>new Date(`${value}T12:00:00Z`).toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'})
export function LawPublication({result}:{result:LawPublicationResult}){
 if(result.error)return <p role="alert" className="text-sm">No se ha podido verificar el vínculo con el BOE. El fallo no acredita ausencia de publicación.</p>
 if(!result.bill)return <p className="text-sm">Sin publicación acreditada en este piloto de proyectos aprobados de la legislatura XV. La ausencia de vínculo no demuestra que no exista una publicación; consulta la ficha oficial.</p>
 const b=result.bill
 return <div className="space-y-4 text-sm leading-6">
  <p>Vínculo acreditado: la sección B.O.E. del <a href={b.source_url} className="underline underline-offset-4">expediente {b.number}</a> enlaza cada PDF. Su CVE identifica la publicación cuyos metadatos se consultan en el BOE.</p>
  {b.documents.map(d=><article key={d.boe_id} className="rounded border p-4 space-y-3">
   <h4 className="font-semibold">{d.kind==='correction'?'Corrección de errores':'Ley publicada'} · {d.boe_id}</h4>
   <p>{d.title}</p>
   <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="font-semibold">Publicación en BOE</dt><dd>{date(d.publication_date)} · número {d.diary_number}</dd></div><div><dt className="font-semibold">Entrada en vigor registrada por BOE</dt><dd>{d.kind==='correction'?'No se trata como otra ley ni se asigna otra entrada en vigor':d.commencement_date?date(d.commencement_date):'Fecha no informada; consultar el texto publicado'}</dd></div></dl>
   {d.commencement_date && d.commencement_date<d.publication_date && <p>La fecha registrada precede a la publicación. Se conserva literalmente: consulta la disposición de entrada en vigor y sus excepciones; no se deduce aplicación uniforme de esta fecha.</p>}
   <div className="flex flex-wrap gap-x-4 gap-y-2"><a href={d.pdf_url} className="underline underline-offset-4">PDF enlazado por Congreso →</a><a href={d.boe_url} className="underline underline-offset-4">Texto publicado y disposiciones →</a><a href={d.official_pdf_url} className="underline underline-offset-4">PDF del BOE →</a><a href={d.xml_url} className="underline underline-offset-4">Metadatos de fechas →</a></div>
  </article>)}
  <p>La entrada en vigor registrada no significa que todas las obligaciones se apliquen el mismo día: puede haber disposiciones transitorias, excepciones y fechas diferidas. No se calcula desde una votación ni se interpreta la aplicación a un caso personal.</p>
  <p>Esta conexión acredita publicación y fecha de la fuente; no afirma que la norma conserve hoy todas sus disposiciones originales. Consulta también las modificaciones posteriores y, cuando exista, el texto consolidado del BOE, que tiene carácter informativo.</p>
  {result.checkedAt && <p className="text-muted-foreground">Vínculo y metadatos consultados el {new Date(result.checkedAt).toLocaleDateString('es-ES',{timeZone:'UTC'})}. Piloto acotado a proyectos de ley aprobados de la legislatura XV.</p>}
 </div>
}
