export interface HousingPriceRow {period:string;territory:string;kind:'general'|'new'|'used';index:number;annual:number;quarterly:number}
export interface HousingSnapshot {version:string;base:number;source_url:string;source_sha256:string;retrieved_at:string;territories:Record<string,string>;missing:{territory:string;kind:string}[];rows:HousingPriceRow[]}
export const HOUSING_SOURCE='https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/79563?nult=100'
export const HOUSING_TYPES={general:'Todas las viviendas',new:'Vivienda nueva',used:'Vivienda de segunda mano'}
export function quarterOrdinal(p:string):number|null{const m=/^(\d{4})-Q([1-4])$/.exec(p);return m?Number(m[1])*4+Number(m[2])-1:null}
export function housingSnapshot(input:unknown):HousingSnapshot|null{
  if(!input || typeof input!=='object')return null
  const s=input as HousingSnapshot
  if(s.version!=='ipv-2025-v1' || s.base!==2025 || s.source_url!==HOUSING_SOURCE || !/^[a-f0-9]{64}$/.test(s.source_sha256 ?? '') || !Number.isFinite(Date.parse(s.retrieved_at)) || !s.territories || Object.keys(s.territories).length!==20 || !Array.isArray(s.missing) || s.missing.length!==4 || !Array.isArray(s.rows) || !s.rows.length || s.rows.length>5600)return null
  for(let n=0;n<20;n++)if(typeof s.territories[n.toString().padStart(2,'0')]!=='string' || !s.territories[n.toString().padStart(2,'0')])return null
  if(s.missing.some(m=>!m || typeof m.territory!=="string" || typeof m.kind!=="string"))return null
  const missing=new Set(s.missing.map(m=>`${m.territory}/${m.kind}`))
  if(missing.size!==4 || ['18/new','18/used','19/new','19/used'].some(k=>!missing.has(k)))return null
  const lookup=new Map<string,HousingPriceRow>(),periods=new Set<number>()
  for(const r of s.rows){
    if(!r || typeof r.period!=='string')return null
    const ordinal=quarterOrdinal(r.period),key=`${r.period}/${r.territory}/${r.kind}`
    if(ordinal===null || ordinal<2020*4 || ordinal>= (new Date().getUTCFullYear()+1)*4 || !Object.hasOwn(s.territories,r.territory) || !Object.hasOwn(HOUSING_TYPES,r.kind) || missing.has(`${r.territory}/${r.kind}`) || lookup.has(key) || [r.index,r.annual,r.quarterly].some(v=>typeof v!=='number' || !Number.isFinite(v)) || r.index<=0)return null
    periods.add(ordinal);lookup.set(key,r)
  }
  const sorted=[...periods].sort((a,b)=>a-b)
  if(sorted.length>100 || sorted.some((p,i)=>p!==sorted[0]+i) || s.rows.length!==sorted.length*56)return null
  for(const ordinal of sorted){
    const period=`${Math.floor(ordinal/4)}-Q${ordinal%4+1}`
    for(const territory of Object.keys(s.territories))for(const kind of Object.keys(HOUSING_TYPES)){
      if(missing.has(`${territory}/${kind}`))continue
      const row=lookup.get(`${period}/${territory}/${kind}`)
      if(!row)return null
      for(const [offset,rate] of [[1,row.quarterly],[4,row.annual]]){
        const prev=ordinal-offset,p=`${Math.floor(prev/4)}-Q${prev%4+1}`,old=lookup.get(`${p}/${territory}/${kind}`)
        if(old && Math.abs((row.index/old.index-1)*100-rate)>.065)return null
      }
    }
  }
  for(const territory of Object.keys(s.territories))for(const kind of Object.keys(HOUSING_TYPES)){
    if(missing.has(`${territory}/${kind}`))continue
    const base=[1,2,3,4].map(q=>lookup.get(`2025-Q${q}/${territory}/${kind}`)?.index)
    if(base.some(v=>v===undefined) || Math.abs((base as number[]).reduce((a,b)=>a+b,0)/4-100)>.002)return null
  }
  return s
}
export function housingSelection(s:HousingSnapshot,period?:string|string[],territory?:string|string[]){
 const periods=[...new Set(s.rows.map(r=>r.period))].sort().reverse()
 const p=period===undefined?periods[0]:period,t=territory===undefined?'00':territory
 if(typeof p!=='string' || typeof t!=='string' || !periods.includes(p) || !/^\d{2}$/.test(t) || !Object.hasOwn(s.territories,t))return null
 return {period:p,territory:t,periods,rows:s.rows.filter(r=>r.period===p && r.territory===t)}
}
