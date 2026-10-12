export const FINANCING_SOURCE = 'https://www.hacienda.gob.es/cdi/sist%20financiacion%20y%20deuda/informaci%C3%B3nccaa/cuadros-liquidacion-2024.xlsx'
export const FINANCING_PAGE = 'https://www.hacienda.gob.es/es-ES/CDI/Paginas/SistemasFinanciacionDeuda/InformacionCCAAs/Informes%20financiacion%20comunidades%20autonomas2.aspx'
export const FINANCING_METHOD = 'https://www.hacienda.gob.es/cdi/sist%20financiacion%20y%20deuda/informaci%C3%B3nccaa/liquidacion-de-los-recursos-sfa-2024.pdf'
export const FINANCING_TERRITORIES: Record<string,string> = {
 '01':'Andalucía','02':'Aragón','03':'Principado de Asturias','04':'Illes Balears','05':'Canarias','06':'Cantabria','07':'Castilla y León','08':'Castilla-La Mancha','09':'Cataluña','10':'Extremadura','11':'Galicia','12':'Comunidad de Madrid','13':'Región de Murcia','16':'La Rioja','17':'C. Valenciana','18':'Ceuta','19':'Melilla',
}
export const FINANCING_COMPONENTS = {
 irpf:'Ajuste de IRPF',iva:'Ajuste de IVA',special:'Ajuste de impuestos especiales',guarantee:'Ajuste del Fondo de Garantía',sufficiency:'Ajuste del Fondo de Suficiencia Global',resources:'Subtotal de ajustes de recursos',competitiveness:'Fondo de Competitividad',cooperation:'Fondo de Cooperación',total:'Saldo global bruto de liquidación',
}
export type FinancingComponent=keyof typeof FINANCING_COMPONENTS
export type FinancingBalances=Record<FinancingComponent,number>
export type FinancingDetail={definitive:number;advance:number;balance:number}
export interface FinancingRegion {territory:string;name:string;group:'city'|'common';balances:FinancingBalances;details:Partial<Record<FinancingComponent,FinancingDetail|null>>}
export interface FinancingSnapshot {version:string;year:number;publication:string;unit:string;source_url:string;page_url:string;method_url:string;workbook_sha256:string;retrieved_at:string;records:FinancingRegion[];totals:Record<string,FinancingBalances>}
const fields=Object.keys(FINANCING_COMPONENTS) as FinancingComponent[]
const close=(a:number,b:number)=>Math.abs(a-b)<=0.05
const keys=(o:object,expected:string[])=>Object.keys(o).sort().join('|')===expected.sort().join('|')
const numeric=(n:unknown):n is number=>typeof n==='number' && Number.isFinite(n) && Math.abs(n)<=1e9
function balances(b:FinancingBalances){
 return b && keys(b,[...fields]) && fields.every(c=>numeric(b[c])) && close(b.irpf+b.iva+b.special+b.guarantee+b.sufficiency,b.resources) && close(b.resources+b.competitiveness+b.cooperation,b.total)
}
export function financingSnapshot(raw:unknown):FinancingSnapshot|null{
 try{
  const s=raw as FinancingSnapshot
  if(!s || s.version!=='territorial-financing-2024-v1' || s.year!==2024 || s.publication!=='2026-07' || s.unit!=='MILES_EUR' || s.source_url!==FINANCING_SOURCE || s.page_url!==FINANCING_PAGE || s.method_url!==FINANCING_METHOD || !/^[a-f0-9]{64}$/.test(s.workbook_sha256) || !s.retrieved_at || !Number.isFinite(Date.parse(s.retrieved_at)) || !Array.isArray(s.records) || s.records.length!==17 || new Set(s.records.map(r=>r.territory)).size!==17)return null
  for(const r of s.records){
   const city=['18','19'].includes(r.territory)
   if(r.name!==FINANCING_TERRITORIES[r.territory] || !r.name || r.group!==(city?'city':'common') || !balances(r.balances) || !r.details || !keys(r.details,city?['sufficiency']:['irpf','iva','guarantee','sufficiency']))return null
   for(const [c,d] of Object.entries(r.details)){
    if(c==='iva' && r.territory==='05' && d===null)continue
    if(!d || !keys(d,['definitive','advance','balance']) || !Object.values(d).every(numeric) || !close(d.definitive-d.advance,d.balance) || !close(d.balance,r.balances[c as FinancingComponent]))return null
   }
  }
  if(!s.totals || !keys(s.totals,['Total CC.AA.','Total Ciudades','Total General']) || !Object.values(s.totals).every(balances))return null
  for(const c of fields){
   for(const [label,group] of [['Total CC.AA.','common'],['Total Ciudades','city']])if(!close(s.records.filter(r=>r.group===group).reduce((sum,r)=>sum+r.balances[c],0),s.totals[label][c]))return null
   if(!close(s.totals['Total CC.AA.'][c]+s.totals['Total Ciudades'][c],s.totals['Total General'][c]))return null
  }
  return s
 }catch{return null}
}
export function selectFinancing(s:FinancingSnapshot|null,year?:string|string[],territory?:string|string[]){
 const y=year===undefined?'2024':typeof year==='string'?year:null
 const t=territory===undefined?'all':typeof territory==='string'?territory:null
 const region=s?.records.find(r=>r.territory===t)??null
 return {available:!!s && y==='2024' && (t==='all'||!!region),region,territory:t}
}
