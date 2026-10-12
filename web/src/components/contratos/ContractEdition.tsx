import { publishedMoney, type ContractEdition } from "@/lib/contract-edition"
export function PublishedContractEdition({ edition }: { edition: ContractEdition | null }) {
  if (!edition) return <section className="space-y-2 rounded border p-4 text-sm leading-6" aria-label="Alcance de la edición"><p>Edición por identificador oficial aún no verificada en el portal. Los campos históricos de adjudicación pueden describir solo un resultado; no acreditan el total del expediente ni todos sus lotes.</p></section>
  return <section className="space-y-4" aria-label="Lotes y resultados publicados">
    <h2 className="text-xl font-semibold">¿Qué alcance tiene cada importe?</h2>
    <p className="text-sm leading-6">Identidad oficial PCSP: <span className="break-all font-mono">{edition.source_id}</span>. Edición de la fuente: {edition.source_updated}. El número de expediente interno puede repetirse en otras administraciones.</p>
    <p className="text-sm leading-6">{edition.lots.length} lotes y {edition.results.length} resultados publicados en esta edición. Presupuesto del proyecto, presupuestos de lotes y adjudicaciones son fases y perímetros diferentes; no se suman entre sí. Ausencia de resultados no prueba falta de adjudicación o pago.</p>
    <p className="text-sm leading-6">Presupuesto del proyecto sin impuestos: {publishedMoney(edition.project.budget_excluding_tax)}. Se conserva la precisión original. CPV publicados: {edition.project.cpv_codes.join(", ") || "no disponibles"}.</p>
    {edition.lots.length > 0 && <details className="text-sm leading-6"><summary className="cursor-pointer underline">Presupuestos publicados por lote</summary><ul className="mt-3 space-y-3">{edition.lots.map((lot, i) => <li key={i} className="rounded border p-3"><p>Lote {lot.id ?? "sin identificador publicado"} · {lot.project.name ?? "objeto no publicado"}</p><p>Sin impuestos: {publishedMoney(lot.project.budget_excluding_tax)}</p><p>CPV: {lot.project.cpv_codes.join(", ") || "no disponibles"}</p></li>)}</ul></details>}
    <div className="space-y-3">{edition.results.map((r, i) => <article key={i} className="min-w-0 space-y-2 rounded border p-4 text-sm leading-6">
      <h3 className="font-semibold">Resultado publicado {i+1} · {r.lot_id ? `lote ${r.lot_id}` : "sin lote identificado"}</h3>
      <p>Código de resultado: {r.result_code ?? "no publicado"} · fecha publicada del resultado: {r.award_date ?? "no publicada"}.</p>
      <p>Destinatario publicado: {r.contractor ?? "no identificado"}. La falta de destinatario no demuestra que el resultado sea una adjudicación.</p>
      <p>Importe del resultado sin impuestos: {publishedMoney(r.award_excluding_tax)}.</p>
      <p>Importe con impuestos: {publishedMoney(r.award_including_tax)}.</p>
      <p>Ofertas recibidas en este resultado: {r.received_tenders ?? "no publicadas"}. No se suman como licitadores únicos del expediente.</p>
    </article>)}</div>
    <p className="text-sm leading-6">Es el contenido publicado, no un inventario de resultados que aún no constan, modificaciones futuras o pagos ejecutados. Un cero publicado se conserva; una cifra ausente no se convierte en cero.</p>
  </section>
}
