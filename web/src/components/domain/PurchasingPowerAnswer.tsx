import Link from "next/link"
import { selectPurchasingPowerYear, signedPercent, type PurchasingPower } from "@/lib/wage-prices"

const euros = (value: number) => `${Math.round(value).toLocaleString("es-ES")} €`

export function PurchasingPowerAnswer({ data, year }: { data: PurchasingPower | null; year?: string | string[] }) {
  const heading = <h2 className="text-xl font-semibold">¿Ha subido el salario medio más que los precios?</h2>
  if (!data)
    return (
      <section className="space-y-3" aria-label="Primera respuesta sobre capacidad de compra">
        {heading}
        <p role="status">No hay años completos de salario medio e IPC para compararlos. No significa que no haya cambios.</p>
      </section>
    )
  const selected = selectPurchasingPowerYear(data, year)
  const form = (
    <form action="/economia" method="get" className="flex flex-wrap items-end gap-3">
      <label className="text-sm" htmlFor="power-year">
        Año
        <select id="power-year" name="year" defaultValue={selected ? String(selected.year) : ""} className="block max-w-full rounded-sm border bg-background p-2">
          {!selected && <option value="" disabled>Año no disponible</option>}
          {[...data.years].reverse().map((row) => <option key={row.year} value={row.year}>{row.year}</option>)}
        </select>
      </label>
      <button type="submit" className="rounded-sm border px-3 py-2 text-sm">Comparar</button>
    </form>
  )
  if (!selected)
    return (
      <section className="space-y-4" aria-label="Primera respuesta sobre capacidad de compra">
        {heading}
        {form}
        <p role="alert">Año sin salario medio publicado o sin doce meses de IPC. No se sustituye por otro año.</p>
      </section>
    )
  const gained = selected.realChange > 0
  const lost = selected.realChange < 0
  return (
    <section className="space-y-4" aria-label="Primera respuesta sobre capacidad de compra">
      {heading}
      <p className="text-base leading-7">
        En {selected.year}, el salario medio bruto anual subió <span className="font-mono">{signedPercent(selected.wageChange)}</span> y la media anual de precios{" "}
        <span className="font-mono">{signedPercent(selected.priceChange)}</span>: el salario medio {gained ? "ganó" : lost ? "perdió" : "mantuvo"} capacidad de compra
        {gained || lost ? <> (<span className="font-mono">{signedPercent(selected.realChange)}</span> en términos reales)</> : null}.
      </p>
      {form}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-sm border p-4">
          <dt className="text-sm">Salario medio bruto anual {selected.year}</dt>
          <dd className="font-mono text-2xl">{euros(selected.wage)}</dd>
        </div>
        <div className="rounded-sm border p-4">
          <dt className="text-sm">Desde {data.baseYear}: salario / precios</dt>
          <dd className="font-mono text-2xl">{signedPercent(selected.cumulativeWage)} / {signedPercent(selected.cumulativePrice)}</dd>
        </div>
        <div className="rounded-sm border p-4">
          <dt className="text-sm">Cambio real acumulado desde {data.baseYear}</dt>
          <dd className="font-mono text-2xl">{signedPercent(selected.cumulativeReal)}</dd>
        </div>
      </dl>
      <div className="space-y-2 text-sm leading-6">
        <p>
          Una media no describe a cada persona: cambia también cuando cambia quién trabaja (más o menos empleo de salario bajo, jornadas, sectores). Es salario bruto, antes de impuestos y cotizaciones, y el IPC es una cesta media que no reproduce el gasto de cada hogar.
        </p>
        <p>
          No atribuye la evolución a una decisión concreta: precios y salarios responden a muchas causas, entre ellas la política monetaria del BCE.
        </p>
        <p>
          Fuentes: INE, <a href="https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736177025&menu=ultiDatos&idp=1254735976596" className="underline underline-offset-4">Encuesta Anual de Estructura Salarial</a> (salario medio bruto anual por trabajador) e{" "}
          <a href="https://www.ine.es/dyngs/INEbase/operacion.htm?c=Estadistica_C&cid=1254736176802&menu=ultiDatos&idp=1254735976607" className="underline underline-offset-4">IPC</a> general, media de los doce índices mensuales de cada año.
        </p>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/distribucion-salarial" className="underline underline-offset-4">Cómo se reparte el salario, más allá de la media →</Link>
        <Link href="/calculadoras" className="underline underline-offset-4">Calcular tu propio importe con el IPC →</Link>
        <Link href={`/economia?year=${selected.year}`} className="underline underline-offset-4">Enlace a esta comparación</Link>
      </div>
    </section>
  )
}
