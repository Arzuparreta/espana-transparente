import territories from './local-liquidation-territories.json'
import {CHAPTERS,type Chapter} from './budget-execution'
export {CHAPTERS}
export const LOCAL_TERRITORIES=territories as Record<string,string>
export const LOCAL_SOURCE='https://datos.canarias.es/api/estadisticas/statistical-resources/v1.0/datasets/ISTAC/E31025B_000018/1.0.json'
export const LOCAL_PAGE='https://datos.canarias.es/catalogos/general/dataset/liquidacion-del-presupuesto-consolidado-de-ingresos-y-gastos-de-las-entidades-locales-segu-20241'
export type LocalValues=[number|null,number|null,number|null,number|null]
export interface LocalMunicipality {territory:string;name:string;rows:Record<Chapter,LocalValues>;reconciled_checks:number}
export interface LocalSnapshot {version:string;year:number;unit:string;source_url:string;page_url:string;source_version:string;source_updated_at:string;source_sha256:string;retrieved_at:string;universe:number;selected_cells:number;missing_cells:number;reconciled_checks:number;complete_comparisons:number;records:LocalMunicipality[]}
const parts=Object.keys(CHAPTERS) as Chapter[]
export function localSnapshot(raw:unknown):LocalSnapshot|null{
 try{
  const s=raw as LocalSnapshot
  if(!s || s.version!=='istac-municipal-liquidation-2024-v1' || s.year!==2024 || s.unit!=='EUR' || s.source_url!==LOCAL_SOURCE || s.page_url!==LOCAL_PAGE || s.source_version!=='1.0' || !/^[a-f0-9]{64}$/.test(s.source_sha256) || !Number.isFinite(Date.parse(s.source_updated_at)) || !Number.isFinite(Date.parse(s.retrieved_at)) || s.universe!==218880 || s.selected_cells!==4224 || !Array.isArray(s.records) || s.records.length!==88 || new Set(s.records.map(r=>r.territory)).size!==88)return null
  let missing=0,checks=0,complete=0
  for(const r of s.records){
   if(!r.name || r.name!==LOCAL_TERRITORIES[r.territory] || !r.rows || Object.keys(r.rows).sort().join('|')!==[...parts].sort().join('|'))return null
   for(const p of parts){
    const nums=r.rows[p]
    if(!Array.isArray(nums) || nums.length!==4 || !nums.every(n=>n===null || (typeof n==='number' && Number.isFinite(n) && n>=0 && n<=1e11)))return null
    missing+=nums.filter(n=>n===null).length
   }
   let localChecks=0
   for(let i=0;i<4;i++){
    for(const [total,sub] of [['NF',['1','2','3','4','5','6','7']],['FIN',['8','9']],['TOTAL',['NF','FIN']]] as [Chapter,Chapter[]][]){
     const nums=sub.map(p=>r.rows[p][i]);const t=r.rows[total][i]
     if(t!==null && nums.every(n=>n!==null)){
      if(Math.abs(nums.reduce<number>((sum,n)=>sum+(n??0),0)-t)>0.10)return null
      localChecks++
     }
    }
   }
   if(localChecks!==r.reconciled_checks)return null
   checks+=localChecks
   if(r.rows.NF.every(n=>n!==null))complete++
  }
  if(s.missing_cells!==missing || s.reconciled_checks!==checks || s.complete_comparisons!==complete)return null
  return s
 }catch{return null}
}
export function localRatio(n:number|null,d:number|null){return n===null || d===null || d===0?null:n/d*100}
export function selectLocal(s:LocalSnapshot|null,year?:string|string[],municipality?:string|string[]){
 const y=year===undefined?'2024':typeof year==='string'?year:null
 const t=municipality===undefined?'all':typeof municipality==='string'?municipality:null
 const selected=s?.records.find(r=>r.territory===t)??null
 return {available:!!s && y==='2024' && (t==='all'||!!selected),selected,territory:t}
}
