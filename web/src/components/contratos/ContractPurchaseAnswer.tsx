import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { formatEuroCompact } from "@/lib/format"
import {
  PURCHASE_LEVELS,
  share,
  summarizePurchases,
  type PurchaseDivision,
  type PurchaseLevel,
} from "@/lib/contract-purchases"
import type { ContractPurchases } from "@/lib/data/contract-purchases"

const number = (value: number) => value.toLocaleString("es-ES")
const TOP = 8

function DivisionItem({ division }: { division: PurchaseDivision }) {
  return (
    <li className="min-w-0 space-y-1 rounded-sm border p-4 text-sm leading-6">
      <p className="font-semibold break-words">
        <span className="font-mono text-xs text-muted-foreground">CPV {division.division === "none" ? "—" : division.division}</span>{" "}
        {division.label}
      </p>
      <p>
        <span className="font-mono">{number(division.expedientes)}</span> expedientes ·{" "}
        presupuesto de licitación <span className="font-mono">{formatEuroCompact(division.budget)}</span>
      </p>
      <p>
        Una sola oferta en <span className="font-mono">{share(division.oneOffer, division.withOffers)}</span> de los resultados con dato
        {" "}(<span className="font-mono">{number(division.oneOffer)}</span> de <span className="font-mono">{number(division.withOffers)}</span>)
      </p>
    </li>
  )
}

export function ContractPurchaseAnswer({
  data,
  level,
}: {
  data: ContractPurchases
  level: PurchaseLevel | null | undefined
}) {
  const heading = <h2 className="text-xl font-semibold">¿Qué se compra y con cuánta competencia?</h2>
  if (data.error)
    return (
      <section className="space-y-3" aria-label="Primera respuesta sobre compras públicas">
        {heading}
        <p role="alert">No se ha podido consultar el resumen de adjudicaciones. El fallo no se presenta como cero compras.</p>
      </section>
    )
  const { coverage, year } = data
  if (!coverage || coverage.years.length === 0)
    return (
      <section className="space-y-3" aria-label="Primera respuesta sobre compras públicas">
        {heading}
        <p role="status">Todavía no hay un resumen calculado de adjudicaciones. No equivale a ausencia de contratos.</p>
      </section>
    )
  const form = (
    <form action="/contratos" method="get" className="flex flex-wrap items-end gap-3">
      <label className="text-sm" htmlFor="award-year">
        Año de adjudicación
        <select id="award-year" name="award_year" defaultValue={year?.toString() ?? ""} className="block max-w-full rounded-sm border bg-background p-2">
          {year === null && <option value="" disabled>Año no disponible</option>}
          {[...coverage.years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label className="text-sm" htmlFor="award-level">
        Administración
        <select id="award-level" name="award_level" defaultValue={level ?? "all"} className="block max-w-full rounded-sm border bg-background p-2">
          <option value="all">Todas</option>
          {Object.entries(PURCHASE_LEVELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <button type="submit" className="rounded-sm border px-3 py-2 text-sm">Consultar compras</button>
    </form>
  )
  if (year === null || level === undefined)
    return (
      <section className="space-y-4" aria-label="Primera respuesta sobre compras públicas">
        {heading}
        {form}
        <p role="alert">Año o administración fuera de la cobertura calculada. No se sustituye por otra selección.</p>
      </section>
    )
  const s = summarizePurchases(data.rows, year, level)
  const scope = level ? PURCHASE_LEVELS[level].toLowerCase() : "todas las administraciones"
  const withOffers = s.results - s.offersUnknown
  const top = s.divisions.slice(0, TOP)
  const query = new URLSearchParams({ award_year: String(year), ...(level ? { award_level: level } : {}) })
  return (
    <section className="space-y-4" aria-label="Primera respuesta sobre compras públicas">
      {heading}
      <p className="text-sm leading-6">
        Expedientes con adjudicación publicada en {year}{s.partialYear && coverage.latest_award_date ? ` (año en curso, hasta el ${new Date(coverage.latest_award_date).toLocaleDateString("es-ES", { timeZone: "UTC" })})` : ""} · {scope} ·
        perfiles de contratante alojados en la PCSP. Se agrupan por el objeto principal del expediente (división CPV).
      </p>
      {form}
      {s.expedientes === 0 && s.results === 0 ? (
        <p role="status">No constan adjudicaciones publicadas para esta selección en la cobertura calculada.</p>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm border p-4">
              <dt className="text-sm">Expedientes adjudicados</dt>
              <dd className="font-mono text-2xl">{number(s.expedientes)}</dd>
            </div>
            <div className="rounded-sm border p-4">
              <dt className="text-sm">Presupuesto de licitación sin IVA</dt>
              <dd className="font-mono text-2xl">{formatEuroCompact(s.budget)}</dd>
              <dd className="text-xs">No es importe adjudicado ni pagado{s.budgetMissing ? ` · ${number(s.budgetMissing)} expedientes sin presupuesto en euros` : ""}</dd>
            </div>
            <div className="rounded-sm border p-4">
              <dt className="text-sm">Resultados con una sola oferta</dt>
              <dd className="font-mono text-2xl">{share(s.oneOffer, withOffers)}</dd>
              <dd className="text-xs">
                <span className="font-mono">{number(s.oneOffer)}</span> de <span className="font-mono">{number(withOffers)}</span> resultados con número de ofertas publicado
              </dd>
            </div>
          </dl>
          <p className="text-sm leading-6">
            Ofertas recibidas por resultado: 1 oferta, <span className="font-mono">{number(s.oneOffer)}</span> · de 2 a 4,{" "}
            <span className="font-mono">{number(s.twoToFour)}</span> · 5 o más, <span className="font-mono">{number(s.fivePlus)}</span> · sin dato,{" "}
            <span className="font-mono">{number(s.offersUnknown)}</span>. Una sola oferta no prueba irregularidad: puede deberse al mercado, al objeto o a la urgencia; indica menos competencia observable.
          </p>
          <h3 className="text-lg font-semibold">Objetos de compra con mayor presupuesto de licitación</h3>
          <ol className="grid gap-3 md:grid-cols-2">
            {top.map((division) => <DivisionItem key={division.division} division={division} />)}
          </ol>
          {s.divisions.length > TOP && (
            <details className="rounded-sm border p-4">
              <summary className="cursor-pointer text-sm font-semibold">Todas las divisiones CPV ({s.divisions.length})</summary>
              <ol className="mt-3 grid gap-3 md:grid-cols-2">
                {s.divisions.slice(TOP).map((division) => <DivisionItem key={division.division} division={division} />)}
              </ol>
            </details>
          )}
        </>
      )}
      <div className="space-y-2 text-sm leading-6">
        <p>
          Un expediente se cuenta en el año de su primera adjudicación publicada; un expediente con varios lotes aporta un resultado por lote adjudicado.
          En registros anteriores a la identidad verificada de la fuente (<span className="font-mono">{number(s.legacyResults)}</span> de{" "}
          <span className="font-mono">{number(s.results)}</span> resultados de esta selección), un expediente con varios lotes solo conserva su primer resultado.
        </p>
        <p>
          No incluye contratos menores ni las licitaciones que las comunidades publican en sus propias plataformas. Se excluyen{" "}
          <span className="font-mono">{number(coverage.annulled_excluded)}</span> expedientes anulados,{" "}
          <span className="font-mono">{number(coverage.without_award_evidence)}</span> sin adjudicatario ni importe publicado y{" "}
          <span className="font-mono">{number(coverage.invalid_award_date)}</span> resultados con fecha de adjudicación inválida o futura (todos los años).
          El domicilio del adjudicatario no indica dónde se ejecuta el contrato.
        </p>
      </div>
      <a href={`/contratos?${query.toString()}`} className="block text-sm underline">Enlace a esta consulta</a>
      <SourceFootnote
        sourceLabel="PCSP · Ministerio de Hacienda"
        sourceHref="https://www.hacienda.gob.es/es-ES/GobiernoAbierto/Datos%20Abiertos/Paginas/LicitacionesContratante.aspx"
        lastChecked={coverage.refreshed_at}
        latestRecordDate={coverage.latest_award_date}
        coverageLabel={`Año de adjudicación ${year} · ${scope} · sin contratos menores`}
      />
    </section>
  )
}
