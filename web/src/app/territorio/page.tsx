import { getSpainMapData } from "@/lib/data/multilevel"
import { SpainMap } from "@/components/domain/SpainMap/SpainMap"
import { TerritoryFallbackList } from "@/components/domain/TerritoryFallbackList"
import { ContextBreadcrumb } from "@/components/layout/ContextBreadcrumb"

export const revalidate = 3600

export const metadata = {
  title: "Territorio",
  description: "Gasto público por comunidad autónoma y municipio en España. Contratos y subvenciones por territorio.",
}

export default async function TerritorioPage() {
  const mapData = await getSpainMapData()
  const totalAmount = mapData.reduce((sum, d) => sum + d.totalAmount, 0)
  const totalRecords = mapData.reduce((sum, d) => sum + d.subsidyCount + d.contractCount, 0)

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-4 py-8 flex flex-col gap-6">
        <ContextBreadcrumb />

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-display font-semibold text-neutral-100">Territorio</h1>
          <p className="text-sm text-neutral-500">
            Gasto público registrado por comunidad autónoma — contratos y subvenciones de fuentes oficiales.
          </p>
        </div>

        {/* Summary strip */}
        <div className="flex items-baseline gap-6 flex-wrap">
          <div>
            <span className="text-xs text-neutral-600 font-mono block">registros</span>
            <span className="text-lg font-mono text-neutral-300">{totalRecords.toLocaleString("es-ES")}</span>
          </div>
          <div>
            <span className="text-xs text-neutral-600 font-mono block">gasto total</span>
            <span className="text-lg font-mono text-[#C8FF00]">
              {totalAmount >= 1_000_000_000
                ? `${(totalAmount / 1_000_000_000).toFixed(1)} mil M€`
                : `${(totalAmount / 1_000_000).toFixed(0)} M€`}
            </span>
          </div>
          <a href="/municipios" className="text-xs font-mono text-neutral-600 hover:text-neutral-400 transition-colors ml-auto">
            Ver municipios →
          </a>
        </div>

        {/* Interactive map (client) */}
        <SpainMap data={mapData} />

        {/* No-JS fallback */}
        <noscript>
          <TerritoryFallbackList data={mapData} />
        </noscript>

      </div>
    </main>
  )
}
