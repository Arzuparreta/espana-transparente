import Link from "next/link"
import type { Metadata } from "next"
import { TerritoryAtlas } from "@/components/domain/TerritoryAtlas"
import { TerritorySpendingGrid } from "@/components/views/TerritorySpendingGrid"
import { getTerritoryAtlas } from "@/lib/data/multilevel"
import {
  ignoredTerritoryParams,
  parseTerritoryDataset,
  parseTerritoryMetric,
} from "@/lib/territory-catalog"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Contratos y subvenciones por territorio",
  description:
    "Atlas territorial de contratos licitados y subvenciones concedidas por comunidad autónoma, provincia y municipio, con liquidaciones y financiación de cada administración.",
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

  const ignored = ignoredTerritoryParams(
    { source: first(params?.source), metric: first(params?.metric), year: rawYear, territory: rawTerritory },
    data.years,
    territoryKeys,
  )

  return (
    <>
      {ignored.length > 0 ? (
        <p role="alert" className="ui-page-wide pt-5 text-sm leading-6">
          {ignored.join(", ")}: valor no disponible en el atlas. Se muestra la vista inicial, no una selección equivalente.
        </p>
      ) : null}
      <section className="ui-page-wide py-5 text-sm leading-6"><Link href="/liquidacion-autonomica?year=2024&territory=all" className="underline underline-offset-4">¿Qué ejecutó tu administración autonómica en 2024? →</Link><Link href="/liquidacion-local?year=2024&municipality=all" className="block underline underline-offset-4">¿Qué autorizó y pagó tu ayuntamiento? Piloto de Canarias →</Link><Link href="/financiacion-territorial?year=2024&territory=all" className="block underline underline-offset-4">¿Qué ajuste de financiación corresponde a tu administración? →</Link><p className="text-muted-foreground">Liquidación presupuestaria definitiva: crédito, obligaciones y pagos. Tiene su propio ejercicio y ámbito; no se suma a los contratos y subvenciones del mapa.</p></section>
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
            Contratos y subvenciones de administraciones locales
          </h2>
          <p className="text-sm text-muted-foreground">
            El mapa cubre comunidades autónomas y provincias. Los ayuntamientos y entidades locales
            con territorio resoluble en las fuentes se listan aquí. Importe concedido de subvenciones y
            presupuesto de licitación de contratos se muestran por separado: no son gasto ejecutado.
          </p>
        </div>
        <TerritorySpendingGrid scope="municipal" />
      </section>
    </>
  )
}
