/**
 * Compact es-ES euro formatting shared by all money surfaces.
 *
 * One scale, one style everywhere: "519,0 mil M €" · "23,4 M €" ·
 * "850 K €" · "120 €". Previously each page declared its own variant
 * with divergent decimals/spacing ("299M €", "mil M€", "1,29 mil M €").
 */
export function formatEuroCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} M €`
  if (abs >= 1_000) return `${Math.round(value / 1_000)} K €`
  return `${Math.round(value).toLocaleString("es-ES")} €`
}
