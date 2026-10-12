const PAYMASTERS={"01": "ANDALUCÍA", "02": "ARAGÓN", "03": "ASTURIAS", "04": "BALEARES", "05": "CANARIAS", "06": "CANTABRIA", "07": "CASTILLA Y LEÓN", "08": "CASTILLA-LA MANCHA", "09": "CATALUÑA", "10": "C. VALENCIANA", "11": "EXTREMADURA", "12": "GALICIA", "13": "MADRID", "14": "MURCIA", "15": "NAVARRA", "16": "PAÍS VASCO", "17": "LA RIOJA", "FEGA": "F.E.G.A."} as const
export const PAC_FUNDS={feaga:"FEAGA", "feader-2014-2022":"FEADER · periodo 2014–2022", "feader-2023-2027":"FEADER · PEPAC 2023–2027"} as const
export type PacFund=keyof typeof PAC_FUNDS
export interface PacRow{label:string;code:string|null;amounts_cents:number[]}
export interface PacTable{page:number;rows:PacRow[];total_cents:number[]}
export interface PacSnapshot{version:string;scope:string;exercise:number;period_start:string;period_end:string;retrieved_at:string;source:{page_url:string;pdf_url:string;sha256:string};programmes:Record<PacFund,{categories:PacTable;territories:PacTable}>}
export function pacSnapshot(value:unknown):PacSnapshot|null{
 if(!value||typeof value!=="object")return null
 const s=value as PacSnapshot
 if(s.version!=="pac-payments-2025-v1"||s.scope!=="financial-2025"||s.exercise!==2025||s.period_start!=="2024-10-16"||s.period_end!=="2025-10-15"||!Number.isFinite(Date.parse(s.retrieved_at))||s.source?.page_url!=="https://www.fega.gob.es/datos-abiertos/informes/informe-cierre-ejercicio-2025-datos-consolidados"||s.source.pdf_url!=="https://www.fega.gob.es/sites/default/files/files/document/PAGOS_FEAGA_FEADER-OCTUBRE-2025_DATOS-CONSOLIDADOS-CIERRE.pdf"||!/^[a-f0-9]{64}$/.test(s.source.sha256))return null
 if(!s.programmes||Object.keys(s.programmes).length!==3)return null
 for(const [fund,count] of Object.entries({feaga:18,"feader-2014-2022":21,"feader-2023-2027":8})){
  const p=s.programmes?.[fund as PacFund];if(!p?.categories||!p.territories)return null
  for(const [kind,t] of Object.entries(p)){
   if(!["categories","territories"].includes(kind)||!t||!Number.isInteger(t.page)||t.page<1||t.page>100||!Array.isArray(t.rows)||t.rows.length!==(kind==="categories"?count:18))return null
   const columns=kind==="categories"&&fund!=="feaga"?2:1
   if(!Array.isArray(t.total_cents)||t.total_cents.length!==columns||!t.total_cents.every(Number.isSafeInteger))return null
   const labels=new Set<string>(),codes=new Set<string>()
   for(const r of t.rows){
    if(!r||typeof r.label!=="string"||!r.label.trim()||labels.has(r.label)||!Array.isArray(r.amounts_cents)||r.amounts_cents.length!==columns||!r.amounts_cents.every(Number.isSafeInteger))return null
    labels.add(r.label)
    if(kind==="categories"&&fund!=="feaga"){
     if(typeof r.code!=="string"||!/^(?:\d{2}|113)$/.test(r.code)||codes.has(r.code))return null
     codes.add(r.code)
    }
    if(kind==="territories"){
     if(typeof r.code!=="string"||!(r.code==="FEGA"||/^(0[1-9]|1[0-7])$/.test(r.code))||codes.has(r.code))return null
     if(PAYMASTERS[r.code as keyof typeof PAYMASTERS]!==r.label)return null
     codes.add(r.code)
    }
   }
   if(t.total_cents.some((v,i)=>v!==t.rows.reduce((sum,r)=>sum+r.amounts_cents[i],0)))return null
  }
  if(p.categories.total_cents.at(-1)!==p.territories.total_cents[0])return null
 }
 return s
}
export function selectPac(s:PacSnapshot, year?:string|string[], fund?:string|string[], body?:string|string[]){
 const f=fund??"feaga",b=body??"ES"
 if((year!==undefined&&year!=="2025")||typeof f!=="string"||!Object.hasOwn(PAC_FUNDS,f)||typeof b!=="string")return null
 const programme=s.programmes[f as PacFund],selected=b==="ES"?null:programme.territories.rows.find(r=>r.code===b)
 return b!=="ES"&&!selected?null:{fund:f as PacFund,body:b,programme,selected}
}
export const pacEuro=(cents:number)=>(cents/100).toLocaleString("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:2})
