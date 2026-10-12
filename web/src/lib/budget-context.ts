export const PGE_FOLDERS: Record<number, string> = {
  2024: "PGE2023Prorroga",
  2025: "PGE2024Prorroga",
  2026: "PGE2025Prorroga",
}
export function budgetEditionUrl(year: number) {
  return PGE_FOLDERS[year]
    ? `https://www.sepg.pap.hacienda.gob.es/Presup/${PGE_FOLDERS[year]}/MaestroDocumentos/PGE-ROM/Indice.htm`
    : `https://www.sepg.pap.hacienda.gob.es/sitios/sepg/es-ES/Presupuestos/PGE/PresupuestosEjerciciosAnteriores/Paginas/Ejercicio${year}.aspx`
}
export function publishedBudgetTotal(
  rows: { source_kind?: string | null; total_credit_initial: number | null }[],
) {
  const published = rows.filter((row) => row.source_kind !== "carried_forward")
  return published.length > 0 &&
    published.every((row) => row.total_credit_initial != null)
    ? published.reduce((total, row) => total + row.total_credit_initial!, 0)
    : null
}
export function budgetYearSelection(
  value: string | string[] | undefined,
  years: number[],
) {
  if (value === undefined) return years[years.length - 1]
  return typeof value === "string" &&
    /^\d{4}$/.test(value) &&
    years.includes(Number(value))
    ? Number(value)
    : null
}
