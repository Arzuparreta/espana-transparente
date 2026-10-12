import Link from 'next/link'
import {housingSelection,HOUSING_TYPES,type HousingSnapshot} from '@/lib/housing-prices'
const rate=(n:number)=>`${n>0?'+':''}${n.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})} %`
const quarter=(p:string)=>`${p.slice(0,4)} · trimestre ${p.slice(-1)}`
export function HousingPrices({result,period,territory}:{result:{data:HousingSnapshot|null;error:boolean};period?:string|string[];territory?:string|string[]}){
 if(result.error)return <p role="alert">No se han podido verificar los precios de vivienda. El fallo no significa variación cero.</p>
 if(!result.data)return <p>No hay una edición verificada del índice de compraventa disponible.</p>
 const s=result.data,selected=housingSelection(s,period,territory),periods=[...new Set(s.rows.map(r=>r.period))].sort().reverse()
 return <div className="space-y-6">
  <form method="get" action="/precios-vivienda" className="flex flex-wrap gap-3 items-end">
   <label className="space-y-1">Trimestre de compraventa<select name="period" defaultValue={selected?.period ?? ''} className="block rounded border bg-background px-3 py-2">{!selected && <option value="" disabled>Selección no disponible</option>}{periods.map(p=><option key={p} value={p}>{quarter(p)}</option>)}</select></label>
   <label className="space-y-1">Territorio del índice<select name="territory" defaultValue={selected?.territory ?? ''} className="block rounded border bg-background px-3 py-2 max-w-full">{!selected && <option value="" disabled>Selección no disponible</option>}{Object.entries(s.territories).sort(([a],[b])=>a.localeCompare(b)).map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
   <button type="submit" className="rounded border px-3 py-2">Ver comparación</button>
  </form>
  {!selected ? <p role="alert">Trimestre o territorio inválido o fuera de cobertura. No se sustituye la selección por otra.</p> : <>
   <section className="space-y-3">
    <h2 className="text-xl font-semibold">{s.territories[selected.territory]} · {quarter(selected.period)}</h2>
    <p>La tasa anual compara con el mismo trimestre del año anterior; la trimestral, con el inmediatamente anterior. Miden evolución de precios de compraventa ajustados por composición y calidad.</p>
    <div className="grid gap-4 md:grid-cols-3">{Object.entries(HOUSING_TYPES).map(([kind,label])=>{
     const row=selected.rows.find(r=>r.kind===kind)
     return <article key={kind} className="rounded border p-4 space-y-2"><h3 className="font-semibold">{label}</h3>{row ? <><p className="text-2xl font-semibold">{rate(row.annual)} anual</p><p>{rate(row.quarterly)} trimestral</p><p className="text-sm">Índice base 2025=100: {row.index.toLocaleString('es-ES',{maximumFractionDigits:3})}</p></> : <p>Desglose no publicado en la tabla oficial para este territorio. No es variación cero.</p>}</article>
    })}</div>
    <p className="text-sm">Fuente: <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=79563" className="underline underline-offset-4">INE, IPV base 2025, tabla 79563</a>. El índice no mide euros ni el precio de una vivienda concreta.</p>
   </section>
   <details className="rounded border p-4 space-y-3"><summary className="cursor-pointer font-semibold">Evolución en el mismo territorio: tasas anuales</summary>
    <ol className="space-y-3 mt-3">{periods.map(p=><li key={p} className="rounded border p-3"><h3 className="font-semibold">{quarter(p)}</h3><div className="grid gap-2 sm:grid-cols-3">{Object.entries(HOUSING_TYPES).map(([kind,label])=>{
     const row=s.rows.find(r=>r.period===p && r.territory===selected.territory && r.kind===kind)
     return <p key={kind} className="text-sm">{label}: {row?rate(row.annual):'desglose no publicado'}</p>
    })}</div></li>)}</ol>
   </details>
  </>}
  <section className="space-y-3 text-sm leading-6">
   <h2 className="text-lg font-semibold">Qué significa para quien busca vivienda</h2>
   <p>Este índice sigue viviendas libres compradas por hogares residentes y no residentes en España. Usa precios de escrituración sin impuestos y ajusta los cambios de calidad y composición. Excluye compras por personas jurídicas y vivienda protegida.</p>
   <p>Una subida indica que la compraventa se encarece en ese ámbito. No estima tu alquiler, la cuota hipotecaria ni el porcentaje de tus ingresos necesario para acceder a una vivienda. El IPC de vivienda mide otros conceptos, incluidos alquileres efectivos y suministros.</p>
   <p>Cada territorio tiene su referencia 2025=100. Comparar sus índices no dice dónde es más caro comprar; comparar sus tasas describe cuánto cambian los precios. General, nueva y segunda mano son agregados solapados: no se suman ni se promedian sin ponderaciones.</p>
   <p>El índice y las tasas se muestran en la misma base y edición. La serie histórica se publica reexpresada en base 2025. Ceuta y Melilla solo tienen el general en esta fuente. Datos definitivos; consulta del {new Date(s.retrieved_at).toLocaleDateString('es-ES',{timeZone:'UTC'})}.</p>
   <p><a href="https://www.ine.es/dyngs/Prensa/IPV2T26.htm" className="underline underline-offset-4">Definición y cambio de base del INE</a> · <a href="https://www.ine.es/dynt3/metadatos/es/RespuestaDatos.html?oe=30457" className="underline underline-offset-4">Metodología y cobertura</a>.</p>
   <p><Link href="/distribucion-salarial" className="underline underline-offset-4">Ver cómo se distribuyen los salarios →</Link> · <Link href="/temas/vivienda" className="underline underline-offset-4">Seguir decisiones y dinero sobre vivienda →</Link></p>
   <p>Estos recorridos conservan sus propios periodos y poblaciones. Una coincidencia temporal entre gasto, debate y precios no acredita causalidad.</p>
  </section>
 </div>
}
