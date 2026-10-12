import Link from 'next/link'
import { wageYear,type WageSnapshot } from '@/lib/wage-distribution'
const euros=(n:number)=>`${n.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1})} €`
export function WageDistribution({result,year}:{result:{data:WageSnapshot|null;error:boolean};year?:string|string[]}){
  if(result.error) return <p role="alert">No se ha podido verificar la distribución salarial. El fallo no significa que no existan salarios registrados.</p>
  if(!result.data) return <p>No hay una edición verificada de la distribución salarial disponible.</p>
  const s=result.data,y=wageYear(s,year)
  return <div className="space-y-6">
    <form action="/distribucion-salarial" method="get" className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">Año de salarios<select name="year" defaultValue={y?.year.toString() ?? ''} className="block rounded border bg-background px-3 py-2">
        {!y && <option value="" disabled>Año no disponible</option>}
        {s.years.map(r=><option key={r.year} value={r.year}>{r.year}</option>)}
      </select></label>
      <button type="submit" className="rounded border px-3 py-2">Ver año</button>
    </form>
    {!y ? <p role="alert">Año inválido o fuera de la cobertura. No se sustituye por otro año.</p> : <>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">La media no describe a cada persona · España, {y.year}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded border p-4"><h3 className="font-medium">Salario medio bruto mensual</h3><p className="text-2xl font-semibold">{euros(y.mean)}</p><p className="text-sm">Media de todos los asalariados de la población de referencia, incluidas jornadas parciales.</p></div>
          <div className="rounded border p-4"><h3 className="font-medium">Umbral entre las dos mitades</h3><p className="text-2xl font-semibold">{euros(y.bands[5].lower!)}</p><p className="text-sm">Límite inferior del sexto decil: aproxima la mediana con el redondeo publicado. Separa los cinco tramos inferiores de los cinco superiores.</p></div>
        </div>
        <p className="text-sm">Fuente: <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=66237&L=0" className="underline underline-offset-4">INE, EPA: salarios medios por jornada y decil</a> y <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=66252&L=0" className="underline underline-offset-4">límites de cada decil</a>. Euros corrientes, empleo principal, todo el territorio nacional.</p>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">¿Cómo se reparte el salario?</h2>
        <p>Los deciles ordenan a las personas de menor a mayor salario en diez grupos de aproximadamente el 10 %. Su anchura en euros cambia mucho: pertenecer a un tramo no significa cobrar su media.</p>
        <ol className="grid gap-3 sm:grid-cols-2">
          {y.bands.map((b,i)=><li key={b.decile} className="rounded border p-4 space-y-1">
            <h3 className="font-semibold">Decil {b.decile} · {b.share.toLocaleString('es-ES',{maximumFractionDigits:1})} % de asalariados</h3>
            <p>{i===0 ? `Menos de ${euros(y.bands[1].lower!)}` : i===9 ? `${euros(b.lower!)} o más` : `Desde ${euros(b.lower!)} hasta menos de ${euros(y.bands[i+1].lower!)}`}</p>
            <p className="text-sm">Media dentro del tramo: {euros(b.mean)}</p>
          </li>)}
        </ol>
        <p className="text-sm">Los porcentajes proceden de <a href="https://www.ine.es/jaxiT3/Tabla.htm?t=66199&L=0" className="underline underline-offset-4">INE, asalariados por jornada y decil</a>; están redondeados. El primer límite inferior no está informado y el último tramo no tiene un máximo publicado.</p>
      </section>
    </>}
    <section className="space-y-3 text-sm leading-6">
      <h2 className="text-lg font-semibold">Qué cuenta esta medida</h2>
      <p>Personas de 16 o más años residentes en viviendas familiares en España que han sido ocupadas asalariadas. No representa a toda la ciudadanía, autónomos ni la renta de un hogar.</p>
      <p>Salario bruto del empleo principal: las pagas extraordinarias se prorratean entre doce meses. Una jornada parcial conserva su salario efectivo, sin convertirlo en equivalente a jornada completa. No es el dinero neto que entra en tu cuenta.</p>
      <p>La comparación usa la base poblacional 2021. Cada año conserva la edición consultada de las tablas; una nota de prensa histórica puede mostrar cifras de otra revisión. Las cifras son definitivas según la codificación de las observaciones del INE.</p>
      <p>La media anual de la Encuesta Anual de Estructura Salarial tiene otra población y operación: dividirla por doce no permite sustituir esta distribución. Tampoco se deduce poder adquisitivo de euros nominales sin una comparación de precios y periodos pertinente.</p>
      <p><a href="https://www.ine.es/dyngs/Prensa/dsEPA2024.htm" className="underline underline-offset-4">Definiciones y metodología del INE</a> · Tablas consultadas el {new Date(s.retrieved_at).toLocaleDateString('es-ES',{timeZone:'UTC'})}.</p>
      <p><Link href="/temas/vivienda" className="underline underline-offset-4">Seguir el tema vivienda y sus decisiones →</Link> · <Link href="/calculadoras" className="underline underline-offset-4">Comparar poder adquisitivo con el IPC →</Link></p>
    </section>
  </div>
}
