import type { Metadata } from "next"
import { TerritoryAtlas } from "@/components/domain/TerritoryAtlas"
import { TerritoryPicker } from "@/components/domain/TerritoryPicker"
import { TerritorySpendingGrid } from "@/components/views/TerritorySpendingGrid"
import { getTerritoryAtlas } from "@/lib/data/multilevel"
import {
  parseTerritoryDataset,
  parseTerritoryMetric,
} from "@/lib/territory-catalog"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Tu territorio",
  description:
    "Atlas territorial del dinero público: contratos y subvenciones por comunidad autónoma, provincia y municipio, con comparación por año, expediente e importe por habitante.",
  alternates: { canonical: "/territorio" },
}

interface PageProps {
  searchParams?: Promise<{
    source?: string | string[]
    metric?: string | string[]
    year?: string | string[]
    territory?: string | string[]
  }>
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function TerritorioPage({ searchParams }: PageProps) {
  const params = await searchParams

  const data = await getTerritoryAtlas()
  const rawYear = first(params?.year)
  const parsedYear =
    rawYear === "all"
      ? "all"
      : rawYear && data.years.includes(Number(rawYear))
        ? Number(rawYear)
        : null
  const rawTerritory = first(params?.territory)
  const territoryKeys = new Set(
    data.territories
      .filter((territory) => territory.type === "ccaa")
      .map((territory) => territory.key)
  )

  const pickerTerritories = data.territories
    .filter((t) => t.type === "ccaa" || t.type === "province")
    .map((t) => ({ key: t.key, name: t.name, type: t.type as "ccaa" | "province", parentKey: t.parentKey }))

  return (
    <>
      <section className="ui-page-wide space-y-3 pt-2">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Tu territorio</h1>
          <p className="text-sm text-muted-foreground">
            Elige tu zona para ver el dinero público que se mueve allí: lo que gasta tu
            administración, las empresas con sede en la zona y lo que reciben.
          </p>
        </div>
        <TerritoryPicker territories={pickerTerritories} />
      </section>

      <TerritoryAtlas
        data={data}
        initialDataset={parseTerritoryDataset(params?.source)}
        initialMetric={parseTerritoryMetric(params?.metric)}
        initialYear={parsedYear}
        initialTerritory={rawTerritory && territoryKeys.has(rawTerritory) ? rawTerritory : null}
      />

      <section className="ui-page-wide space-y-4 sm:space-y-6">
        <div className="space-y-1">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Gasto municipal
          </h2>
          <p className="text-sm text-muted-foreground">
            El mapa cubre comunidades autónomas y provincias. Los ayuntamientos y entidades locales
            con territorio resoluble en las fuentes se listan aquí.
          </p>
        </div>
        <TerritorySpendingGrid scope="municipal" />
      </section>
    </>
  )
}
