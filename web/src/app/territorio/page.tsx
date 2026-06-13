import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"
import { PageHeader } from "@/components/domain/PageHeader"
import { SpainMap } from "@/components/domain/SpainMap/SpainMap"
import { TerritoryFallbackList } from "@/components/domain/TerritoryFallbackList"
import { SectionViewNav } from "@/components/navigation/SectionViewNav"
import { getSpainMapData } from "@/lib/data/multilevel"
import { formatEuroCompact } from "@/lib/format"
import { parseView, TERRITORY_VIEWS } from "@/lib/section-views"

export const revalidate = 3600

interface PageProps {
  searchParams?: Promise<{ view?: string | string[] }>
}

const VIEW_META = {
  mapa: {
    title: "Mapa del gasto",
    description: "Contratos y subvenciones registrados por comunidad autónoma.",
  },
  autonomico: {
    title: "Gasto autonómico",
    description: "Contratos y subvenciones con territorio autonómico resoluble en las fuentes.",
  },
  municipal: {
    title: "Gasto municipal",
    description: "Contratos y subvenciones con municipio o entidad local resoluble en las fuentes.",
  },
} as const

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const view = parseView(params?.view, TERRITORY_VIEWS, "mapa")
  return {
    ...VIEW_META[view],
    alternates: {
      canonical:
        view === "autonomico"
          ? "/ccaa"
          : view === "municipal"
            ? "/municipios"
            : "/territorio",
    },
  }
}

export default async function TerritorioPage({ searchParams }: PageProps) {
  const params = await searchParams
  const view = parseView(params?.view, TERRITORY_VIEWS, "mapa")
  if (view === "autonomico") {
    permanentRedirect("/ccaa")
  }
  if (view === "municipal") {
    permanentRedirect("/municipios")
  }
  const meta = VIEW_META[view]
  const navigation = (
    <SectionViewNav
      label="Vistas territoriales"
      active={view}
      items={[
        { value: "mapa", label: "Mapa", href: "/territorio" },
        { value: "autonomico", label: "Autonómico", href: "/ccaa" },
        { value: "municipal", label: "Municipal", href: "/municipios" },
      ]}
    />
  )

  const mapData = await getSpainMapData()
  const totalAmount = mapData.reduce((sum, item) => sum + item.totalAmount, 0)
  const totalRecords = mapData.reduce(
    (sum, item) => sum + item.subsidyCount + item.contractCount,
    0
  )

  return (
    <div className="ui-page-wide space-y-6 sm:space-y-8">
      <PageHeader {...meta} />
      {navigation}
      <div className="flex flex-wrap items-baseline gap-6">
        <div>
          <span className="block font-mono text-xs text-muted-foreground">Registros</span>
          <span className="font-mono text-lg">{totalRecords.toLocaleString("es-ES")}</span>
        </div>
        <div>
          <span className="block font-mono text-xs text-muted-foreground">Gasto registrado</span>
          <span className="font-mono text-lg text-accent">
            {formatEuroCompact(totalAmount)}
          </span>
        </div>
      </div>
      <SpainMap data={mapData} />
      <noscript>
        <TerritoryFallbackList data={mapData} />
      </noscript>
    </div>
  )
}
