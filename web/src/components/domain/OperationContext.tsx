export function OperationContext({
  kind, total, year,
}: {
  kind: "contratos" | "subvenciones"
  total: number
  year: number | null
}) {
  const contracts = kind === "contratos"
  return (
    <section aria-label="Qué mide esta consulta" className="space-y-2 border-y border-border py-4">
      <p className="text-lg font-semibold">
        <span className="font-mono">{total.toLocaleString("es-ES")}</span>{" "}
        {contracts ? "licitaciones" : "concesiones"} en esta consulta
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        {year ? `Año ${year}` : "Todo el histórico disponible"} ·{" "}
        {contracts ? "fecha de actualización en la PCSP; no fecha de adjudicación ni de pago." : "fecha de concesión; no fecha de pago."}
        {" "}El recuento aplica los filtros de la consulta y abarca todas sus páginas.
      </p>
      <p className="text-sm leading-6 text-muted-foreground">
        {contracts ? "Importes ordenados por presupuesto de licitación sin IVA. La ficha muestra la adjudicación cuando está disponible." : "Importes concedidos a organizaciones; no incluye beneficiarios individuales anonimizados en la fuente."}
        {" "}Estos registros no miden todo el gasto público. Los cargos asociados no acreditan una decisión personal.
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        El territorio describe la administración o el domicilio del receptor, según el filtro; no acredita dónde se presta el servicio o quién se beneficia.
      </p>
    </section>
  )
}
