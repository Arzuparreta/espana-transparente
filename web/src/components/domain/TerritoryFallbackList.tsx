import type { SpainMapCcaa } from "@/lib/data/multilevel"
import { TerritoryFlag } from "./TerritoryFlag"

type Props = {
  data: SpainMapCcaa[]
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} mil M€`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} M€`
  return `${n.toLocaleString("es-ES")} €`
}

export function TerritoryFallbackList({ data }: Props) {
  const sorted = [...data].sort((a, b) => b.totalAmount - a.totalAmount)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-800 border border-neutral-800">
      {sorted.map((ccaa) => (
        <a
          key={ccaa.topoKey}
          href={`/ccaa/${ccaa.topoKey.toLowerCase().replace(/_/g, "-")}`}
          className="flex items-center gap-3 bg-[#0f0f0f] px-4 py-3 hover:bg-neutral-900 transition-colors min-w-0"
        >
          <TerritoryFlag territoryName={ccaa.flagKey} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-200 truncate">{ccaa.displayName}</p>
            <p className="text-xs font-mono text-neutral-500 truncate">
              {fmt(ccaa.totalAmount)}
            </p>
          </div>
        </a>
      ))}
    </div>
  )
}
