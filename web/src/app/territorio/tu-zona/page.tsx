import type { Metadata } from "next"
import { TerritoryPicker } from "@/components/domain/TerritoryPicker"
import { getTerritoryAtlas } from "@/lib/data/multilevel"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Tu zona",
  description:
    "Elige tu comunidad autónoma o una provincia para ver, por un lado, el gasto público de tu administración y, por otro, las empresas con sede en la zona que reciben contratos.",
  alternates: { canonical: "/territorio/tu-zona" },
}

export default async function TuZonaPage() {
  const data = await getTerritoryAtlas()
  const pickerTerritories = data.territories
    .filter((t) => t.type === "ccaa" || t.type === "province")
    .map((t) => ({
      key: t.key,
      name: t.name,
      type: t.type as "ccaa" | "province",
      parentKey: t.parentKey,
    }))

  return (
    <div className="ui-page space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Territorio
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Tu zona</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Elige una comunidad autónoma para ver el gasto de tu administración, o
          una provincia para ver las empresas con sede allí que reciben contratos
          públicos. Cambia la selección cuantas veces necesites antes de
          explorar.
        </p>
      </header>
      <TerritoryPicker territories={pickerTerritories} />
    </div>
  )
}
