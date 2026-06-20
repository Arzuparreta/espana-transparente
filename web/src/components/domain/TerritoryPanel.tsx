import type { SelectedCcaa } from "./SpainMap/types"
import { TerritoryFlag } from "./TerritoryFlag"

type Props = {
  selected: SelectedCcaa | null
  onClose: () => void
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} mil M€`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} M€`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} k€`
  return `${n.toLocaleString("es-ES")} €`
}

export function TerritoryPanel({ selected, onClose }: Props) {
  if (!selected) {
    return (
      <div className="hidden lg:flex w-72 shrink-0 flex-col items-center justify-center p-6 border-l border-neutral-800 text-center">
        <p className="text-xs text-neutral-600 font-mono leading-relaxed">
          Haz click sobre una comunidad autónoma para ver sus datos de gasto público
        </p>
      </div>
    )
  }

  const detailHref = `/territorio/ccaa/${encodeURIComponent(selected.routeKey)}`

  return (
    <div className="w-full lg:w-72 shrink-0 border-t border-neutral-800 lg:border-t-0 lg:border-l p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3 min-w-0">
        <TerritoryFlag territoryName={selected.flagKey} className="shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-neutral-100 truncate">{selected.displayName}</h2>
          <p className="text-xs text-neutral-500 font-mono mt-0.5">
            {(selected.subsidyCount + selected.contractCount).toLocaleString("es-ES")} registros
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-neutral-500 shrink-0">Subvenciones</span>
          <span className="text-sm font-mono text-neutral-200 truncate text-right">
            {fmt(selected.subsidyTotal)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-neutral-500 shrink-0">Contratos</span>
          <span className="text-sm font-mono text-neutral-200 truncate text-right">
            {fmt(selected.contractTotal)}
          </span>
        </div>
        <div className="h-px bg-neutral-800 my-1" />
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-neutral-400 shrink-0">Total</span>
          <span className="text-base font-mono text-[#C8FF00] truncate text-right">
            {fmt(selected.subsidyTotal + selected.contractTotal)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto">
        <a
          href={detailHref}
          className="text-xs font-mono text-neutral-400 hover:text-[#C8FF00] transition-colors"
        >
          Ver detalle completo →
        </a>
        <button
          onClick={onClose}
          className="text-xs font-mono text-neutral-600 hover:text-neutral-400 transition-colors text-left"
        >
          ← Toda España
        </button>
      </div>
    </div>
  )
}
