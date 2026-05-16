import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { MoneyDataSummary } from "@/components/domain/MoneyDataSummary"
import { StatGrid } from "@/components/domain/StatGrid"
import { SubvencionesClient } from "@/components/subvenciones/SubvencionesClient"
import { PAGE_SIZE_SUBSIDIES, getMoneyDatasetSummary, getSubvencionPage, getSubvencionPageFiltered, parsePage } from "@/lib/data"

export const revalidate = 3600

const VALID_NIVELES = ["all", "ESTADO", "AUTONOMICA", "LOCAL"]

interface PageProps {
  searchParams?: {
    page?: string
    nivel?: string
    ministry?: string
  }
}

export default async function SubvencionesPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const requestedNivel = searchParams?.nivel || "all"
  const activeNivel = VALID_NIVELES.includes(requestedNivel) ? requestedNivel : "all"
  const activeMinistry = searchParams?.ministry?.trim() || null

  const [baseData, filteredData, summary] = await Promise.all([
    getSubvencionPage(page, activeNivel),
    activeMinistry ? getSubvencionPageFiltered(page, activeNivel, activeMinistry) : Promise.resolve(null),
    getMoneyDatasetSummary("subsidies"),
  ])

  const { subsidies, total, statsRows } = activeMinistry && filteredData
    ? { subsidies: filteredData.subsidies, total: filteredData.total, statsRows: baseData.statsRows }
    : baseData

  const totalAmount = statsRows.reduce((sum, s) => sum + ((s as { importe?: number }).importe ?? 0), 0)
  const formatted =
    totalAmount >= 1_000_000_000
      ? `${(totalAmount / 1_000_000_000).toFixed(1)}B €`
      : `${(totalAmount / 1_000_000).toFixed(0)}M €`

  const uniqueOrganos = new Set(statsRows.map((s) => (s as { nivel3?: string }).nivel3).filter(Boolean)).size

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Subvenciones"
        description="Concesiones publicadas en la Base de Datos Nacional de Subvenciones (BDNS). Solo organizaciones — beneficiarios individuales están anonimizados en la fuente."
      />

      {statsRows.length > 0 ? (
        <StatGrid
          items={[
            { label: "Concesiones (muestra)", value: statsRows.length.toLocaleString("es-ES") },
            { label: "Importe total muestra", value: formatted },
            { label: "Organismos", value: uniqueOrganos.toLocaleString("es-ES") },
          ]}
        />
      ) : null}

      <MoneyDataSummary datasetHref="/subvenciones" rows={summary.rows} total={summary.total} />

      <SubvencionesClient
        activeNivel={activeNivel}
        activeMinistry={activeMinistry}
        subsidies={subsidies}
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE_SUBSIDIES))}
      />

      <InfoPanel title="Fuente">
        Fuente: Base de Datos Nacional de Subvenciones (BDNS) · Intervención General de la Administración del Estado (IGAE).
        API pública en infosubvenciones.es. Solo se muestran concesiones a organizaciones; los beneficiarios individuales
        están anonimizados en la fuente original y no se almacenan.
      </InfoPanel>
    </div>
  )
}
