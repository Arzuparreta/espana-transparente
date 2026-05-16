import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { MoneyDataSummary } from "@/components/domain/MoneyDataSummary"
import { StatGrid } from "@/components/domain/StatGrid"
import { ContratosClient } from "@/components/contratos/ContratosClient"
import { PAGE_SIZE, getContractPage, getContractPageFiltered, getMoneyDatasetSummary, parsePage } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  searchParams?: {
    page?: string
    type?: string
    ministry?: string
  }
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const requestedType = searchParams?.type || "all"
  const activeType = ["all", "Servicios", "Obras", "Suministros"].includes(requestedType)
    ? requestedType
    : "all"
  const activeMinistry = searchParams?.ministry?.trim() || null

  const [baseData, filteredData, summary] = await Promise.all([
    getContractPage(page, activeType),
    activeMinistry ? getContractPageFiltered(page, activeType, activeMinistry) : Promise.resolve(null),
    getMoneyDatasetSummary("contracts"),
  ])

  const { contracts, total, statsRows } = activeMinistry && filteredData
    ? { contracts: filteredData.contracts, total: filteredData.total, statsRows: baseData.statsRows }
    : baseData

  const totalAmount = statsRows.reduce((sum, c) => sum + (c.amount ?? 0), 0)
  const formatted =
    totalAmount >= 1_000_000_000
      ? `${(totalAmount / 1_000_000_000).toFixed(1)}B €`
      : `${(totalAmount / 1_000_000).toFixed(0)}M €`

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Contratos públicos"
        description="Licitaciones publicadas en la Plataforma de Contratación del Sector Público (PCSP). Ordenadas por importe sin IVA."
      />

      {statsRows.length > 0 ? (
        <StatGrid
          items={[
            { label: "Licitaciones", value: total.toLocaleString("es-ES") },
            { label: "Importe total", value: formatted },
            { label: "Organismos", value: new Set(statsRows.map((c) => c.awarding_body)).size.toLocaleString("es-ES") },
          ]}
        />
      ) : null}

      <MoneyDataSummary datasetHref="/contratos" rows={summary.rows} total={summary.total} />

      <ContratosClient
        activeType={activeType}
        activeMinistry={activeMinistry}
        contracts={contracts}
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE.contracts))}
      />

      <InfoPanel title="Fuente">
        Plataforma de Contratación del Sector Público (PCSP) · Ministerio de Hacienda.
        Datos actualizados mensualmente. Solo se muestran licitaciones cuyo importe supera el umbral de publicación.
      </InfoPanel>
    </div>
  )
}
