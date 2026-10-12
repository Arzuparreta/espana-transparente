export interface WageBand { decile: number; lower: number | null; mean: number; count_thousands: number; share: number }
export interface WageYear { year: number; mean: number; count_thousands: number; bands: WageBand[] }
export interface WageSnapshot { version: string; sources: Record<string,string>; sha256: Record<string,string>; retrieved_at: string; years: WageYear[] }
const tables = [66237,66252,66199]
export function wageSnapshot(value: unknown): WageSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const s=value as WageSnapshot
  if (s.version !== 'epa-monthly-national-2021-v1' || !s.sources || !s.sha256 || typeof s.retrieved_at !== 'string' || !Number.isFinite(Date.parse(s.retrieved_at)) || !Array.isArray(s.years) || !s.years.length || s.years.length > 30) return null
  if (tables.some(t=>s.sources[t]!==`https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/${t}?nult=100` || !/^[a-f0-9]{64}$/.test(s.sha256[t] ?? ''))) return null
  const positive=(n:unknown):n is number=>typeof n==='number' && Number.isFinite(n) && n>0
  const seen=new Set<number>()
  for(const y of s.years){
    if(!y || !Number.isInteger(y.year) || y.year<2021 || y.year>new Date().getUTCFullYear() || seen.has(y.year) || !positive(y.mean) || !positive(y.count_thousands) || !Array.isArray(y.bands) || y.bands.length!==10) return null
    seen.add(y.year)
    for(let i=0;i<10;i++){
      const b=y.bands[i],upper=y.bands[i+1]?.lower
      if(!b || b.decile!==i+1 || (i===0 ? b.lower!==null : !positive(b.lower)) || !positive(b.mean) || !positive(b.count_thousands) || !positive(b.share) || b.share>100) return null
      if(i>0 && b.mean < b.lower!) return null
      if(i<9 && (!positive(upper) || b.mean>=upper || (i>0 && b.lower!>=upper))) return null
      if(Math.abs(b.share-b.count_thousands/y.count_thousands*100)>.11) return null
    }
    const count=y.bands.reduce((a,b)=>a+b.count_thousands,0)
    if(Math.abs(count-y.count_thousands)>.6 || Math.abs(y.bands.reduce((a,b)=>a+b.share,0)-100)>.6 || Math.abs(y.bands.reduce((a,b)=>a+b.mean*b.count_thousands,0)/count-y.mean)>.2) return null
  }
  return {...s,years:[...s.years].sort((a,b)=>b.year-a.year)}
}
export function wageYear(s:WageSnapshot,requested?:string|string[]):WageYear|null {
  if(requested===undefined) return s.years[0] ?? null
  if(typeof requested!=='string' || !/^\d{4}$/.test(requested)) return null
  return s.years.find(y=>y.year===Number(requested)) ?? null
}
