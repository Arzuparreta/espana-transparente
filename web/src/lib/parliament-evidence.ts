/** Exact identifiers and official source fields; no inferred enactment. */
export function initiativeNumbers(number:string){
 const canonical=number.replace(/\/0000$/,"")
 return number!==canonical?[canonical,number]:/^\d{3}\/\d{6}$/.test(number)?[canonical,`${canonical}/0000`]:[number]
}
export function officialDocumentUrls(value:unknown){
 if(typeof value!=="string")return []
 return [...new Set((value.match(/https:\/\/[^\s<>"']+/g)??[]).filter(value=>{
  try{const u=new URL(value);return ["www.congreso.es","www.senado.es","www.boe.es"].includes(u.hostname)&&!u.username&&!u.password&&!u.port}catch{return false}
 }))]
}
export function parliamentEvidence(raw:unknown){
 const data=raw&&typeof raw==="object"?raw as Record<string,unknown>:{}
 const official=data.official&&typeof data.official==="object"?data.official as Record<string,unknown>:{}
 const text=(key:string)=>typeof official[key]==="string"?(official[key] as string).trim():null
 const dates=(key:string)=>typeof data[key]==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(data[key] as string)&&Number.isFinite(Date.parse(data[key] as string))&&new Date(data[key] as string).toISOString().slice(0,10)===data[key]?data[key] as string:null
 return {presentation:dates("presentation_date"),qualification:dates("qualification_date"),
  stages:text("TRAMITACIONSEGUIDA"),rapporteurs:text("PONENTES"),committee:text("COMISIONCOMPETENTE"),
  bulletins:officialDocumentUrls(official.ENLACESBOCG),debates:officialDocumentUrls(official.ENLACESDS),
  laws:officialDocumentUrls(official.ENLACESBOE),officialStatus:text("SITUACIONACTUAL"),officialResult:text("RESULTADOTRAMITACION")}
}
