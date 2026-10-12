import Link from "next/link"
import {PageHeader} from "@/components/domain/PageHeader"
import {SourceFootnote} from "@/components/domain/SourceFootnote"
import {getPacPayments} from "@/lib/data/pac-payments"
import {PAC_FUNDS,pacEuro,selectPac} from "@/lib/pac-payments"
export const revalidate=3600
export const metadata={title:"Pagos PAC · cierre financiero 2025",description:"Pagos FEAGA y FEADER separados por fondo, medida y organismo pagador; cierre consolidado del ejercicio financiero 2025."}
export default async function Page({searchParams}:{searchParams?:Promise<{year?:string|string[];fund?:string|string[];body?:string|string[]}>}){
 const params=await searchParams,{snapshot,error}=await getPacPayments()
 const selection=snapshot?selectPac(snapshot,params?.year,params?.fund,params?.body):null
 return <div className="ui-page space-y-6">
  <PageHeader title="¿Qué pagos registra cada fondo agrario?" description="Cierre consolidado de FEGA: fondos y organismos pagadores separados. Son pagos del ejercicio financiero; no créditos presupuestarios ni concesiones."/>
  <p className="text-sm leading-6">Ejercicio financiero 2025: 16 de octubre de 2024–15 de octubre de 2025. No es el año natural 2025 ni el importe pagado durante toda la vida de un programa. PAC es un instrumento distinto de cohesión y MRR.</p>
  {error?<p role="alert">No se ha podido consultar una edición reconciliada. Un fallo no significa cero pagos.</p>:!snapshot?<p role="status">Todavía no hay una edición disponible.</p>:!selection?<><p role="status">Fondo, ejercicio u organismo no disponible. No se sustituye por otro corte.</p><Link href="/fondos-ue/pac" className="underline">Ver cierre disponible</Link></>:<>
   <form action="/fondos-ue/pac" className="flex flex-wrap items-end gap-3">
    <label className="text-sm" htmlFor="pac-year">Ejercicio financiero<select id="pac-year" name="year" defaultValue="2025" className="block rounded border bg-background p-2"><option value="2025">2025 · cierre consolidado</option></select></label>
    <label className="text-sm" htmlFor="pac-fund">Fondo y periodo del programa<select id="pac-fund" name="fund" defaultValue={selection.fund} className="block max-w-full rounded border bg-background p-2">{Object.entries(PAC_FUNDS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label className="text-sm" htmlFor="pac-body">Organismo pagador<select id="pac-body" name="body" defaultValue={selection.body} className="block rounded border bg-background p-2"><option value="ES">Total nacional</option>{selection.programme.territories.rows.map(r=><option key={r.code} value={r.code!}>{r.label}</option>)}</select></label>
    <button className="rounded border px-3 py-2 text-sm">Ver pagos</button>
   </form>
   <section className="space-y-4">
    <h2 className="text-xl font-semibold">{PAC_FUNDS[selection.fund]} · {selection.selected?.label??"total nacional"}</h2>
    <dl className="grid gap-4 sm:grid-cols-2">{(selection.selected?[selection.selected.amounts_cents[0]]:selection.programme.categories.total_cents).map((amount,i)=><div key={i} className="min-w-0 border-t pt-3"><dt className="text-sm font-semibold">{selection.fund==="feaga"?"Pagos FEAGA":selection.selected||i===1?"Gasto público publicado":"Contribución FEADER publicada"}</dt><dd className="mt-2 break-words font-mono text-2xl">{pacEuro(amount)}</dd></div>)}</dl>
    <p className="text-sm leading-6">FEAGA publica pagos del fondo. FEADER distingue contribución europea y gasto público: no se suman entre sí ni se deriva una cuota nacional por resta. Los periodos 2014–2022 y 2023–2027 identifican programas; ambos importes aquí corresponden a pagos del ejercicio financiero 2025.</p>
    <SourceFootnote sourceLabel="FEGA · cierre consolidado, euros" sourceHref={`${snapshot.source.pdf_url}#page=${selection.selected?selection.programme.territories.page:selection.programme.categories.page}`} lastChecked={snapshot.retrieved_at} coverageLabel="16/10/2024–15/10/2025 · 18 organismos por fondo"/>
   </section>
   {selection.selected?<p className="text-sm leading-6">La selección identifica el organismo pagador, no residencia ni territorio beneficiado. El desglose de ayudas disponible es nacional; no se aplica a este organismo un reparto nacional como si fuera propio. FEGA conserva su fila separada. En la reserva de crisis, la atribución territorial sigue la administración que gestionó la solicitud única PAC 2024.</p>:<section className="space-y-4">
    <h2 className="text-xl font-semibold">¿Qué ayudas, medidas o intervenciones recibieron pagos?</h2>
    {selection.fund==="feaga"?<p className="text-sm leading-6">Las ayudas directas de 2025 separan campaña actual y campañas anteriores. Este cambio de clasificación impide comparar automáticamente cada línea con 2024. No se suman recuentos de beneficiarios: una persona puede aparecer en distintas líneas.</p>:<p className="text-sm leading-6">Se conservan las correcciones negativas como publicadas. Los importes no identifican personas. En PEPAC 2023–2027, asistencia técnica (09) publica contribución FEADER positiva y gasto público cero; conserva sus denominadores y no permite fabricar una cuota nacional.</p>}
    <div className="space-y-3">{selection.programme.categories.rows.map(r=><article key={r.label} className="min-w-0 space-y-2 rounded border p-4"><h3 className="text-sm font-semibold">{r.label}</h3>{r.amounts_cents.map((value,i)=><p key={i} className="text-sm break-words">{selection.fund==="feaga"?"Pago del fondo":i===0?"Contribución FEADER":"Gasto público"}: <span className="font-mono">{pacEuro(value)}</span></p>)}</article>)}</div>
   </section>}
   <p className="text-sm leading-6">No se publica una suma de los tres fondos ni se añade este pago a concesiones o contratos de otras fuentes. Un organismo o medida no acredita una actuación individual. La fuente puede revisar el cierre; fecha de verificación y ejercicio son datos diferentes.</p>
  </>}
  <Link href="/fondos-ue" className="text-sm underline">Volver a instrumentos europeos</Link>
 </div>
}
