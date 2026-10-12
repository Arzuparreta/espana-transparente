export interface LawDocument {boe_id:string;title:string;kind:'law'|'correction';publication_date:string;commencement_date:string|null;official_pdf_url:string;boe_url:string;xml_url:string;xml_sha256:string;pdf_sha256:string;pdf_url:string;citation:string;diary_number:string;boe_updated_at:string|null;status:Record<string,string|null>}
export interface PublishedBill {number:string;title:string;source_url:string;fiche_sha256:string;documents:LawDocument[]}
export interface LawSnapshot {version:string;legislature:number;dataset_url:string;dataset_sha256:string;universe:number;selected:number;documents:number;retrieved_at:string;records:PublishedBill[]}
const hash=(v:unknown)=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v)
const iso=(v:unknown)=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v
export function lawSnapshot(value:unknown):LawSnapshot|null {
 if(!value || typeof value!=='object')return null
 const s=value as LawSnapshot
 if(s.version!=='congress-xv-publications-v1' || s.legislature!==15 || !/^https:\/\/www\.congreso\.es\/webpublica\/opendata\/iniciativas\/ProyectosDeLey__\d+\.json$/.test(s.dataset_url ?? '') || !hash(s.dataset_sha256) || !Number.isFinite(Date.parse(s.retrieved_at)) || !Number.isInteger(s.universe) || s.universe<1 || s.universe>250 || !Number.isInteger(s.selected) || s.selected<1 || s.selected>150 || s.selected>s.universe || !Array.isArray(s.records) || s.records.length!==s.selected)return null
 const seen=new Set<string>();let count=0
 for(const r of s.records){
  if(!r || !/^121\/\d{6}$/.test(r.number ?? '') || seen.has(r.number) || typeof r.title!=='string' || !r.title.trim() || !hash(r.fiche_sha256) || !Array.isArray(r.documents) || !r.documents.length || r.documents.length>5)return null
  seen.add(r.number)
  let u:URL
  try{u=new URL(r.source_url)}catch{return null}
  if(u.username || u.password || u.origin!=='https://www.congreso.es' || u.pathname!=='/es/busqueda-de-iniciativas' || u.searchParams.get('_iniciativas_id')!==r.number || u.searchParams.get('_iniciativas_legislatura')!=='XV' || u.searchParams.get('_iniciativas_mode')!=='mostrarDetalle')return null
  const ids=new Set<string>()
  for(const d of r.documents){
   if(!d || !/^BOE-A-\d{4}-\d+$/.test(d.boe_id ?? '') || ids.has(d.boe_id) || typeof d.title!=='string' || !d.title.trim() || !['law','correction'].includes(d.kind) || !iso(d.publication_date) || (d.commencement_date!==null && !iso(d.commencement_date)) || (d.kind==='correction' && d.commencement_date!==null) || !hash(d.pdf_sha256) || !hash(d.xml_sha256) || !d.status || typeof d.citation!=='string' || !/^\d+$/.test(d.diary_number))return null
   ids.add(d.boe_id);count++
   if(d.boe_url!==`https://www.boe.es/diario_boe/txt.php?id=${d.boe_id}` || d.xml_url!==`https://www.boe.es/diario_boe/xml.php?id=${d.boe_id}` || d.official_pdf_url!==`https://www.boe.es/boe/dias/${d.publication_date.replaceAll('-','/')}/pdfs/${d.boe_id}.pdf` || !/^https:\/\/www\.congreso\.es\/constitucion\/ficheros\/leyes_espa\/[a-zA-Z0-9_]+\.pdf$/.test(d.pdf_url))return null
  }
 }
 return count===s.documents?s:null
}
export function publishedBill(s:LawSnapshot,number:string,legislature:number):PublishedBill|null {
 if(legislature!==s.legislature)return null
 const n=number.replace(/\/0000$/,'')
 return s.records.find(r=>r.number===n) ?? null
}
