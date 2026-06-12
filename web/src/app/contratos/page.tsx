import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { MoneyDataSummary } from "@/components/domain/MoneyDataSummary"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ContratosClient } from "@/components/contratos/ContratosClient"
import {
  PAGE_SIZE,
  getContractPage,
  getContractPageFiltered,
  getEtlLastFinished,
  getMoneyDatasetSummary,
  parsePage,
} from "@/lib/data"
import { formatEuroCompact } from "@/lib/format"

export const revalidate = 3600

export const metadata = {
  title: "Contratos públicos",
  description: "Adjudicaciones del sector público español: importe, contratista, tipo y administración responsable.",
}

const VALID_LEVELS = ["state", "autonomic", "municipal"] as const

interface PageProps {
  searchParams?: {
    page?: string
    type?: string
    ministry?: string
    level?: string
  }
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const requestedType = searchParams?.type || "all"
  const activeType = ["all", "Servicios", "Obras", "Suministros"].includes(requestedType)
    ? requestedType
    : "all"
  const activeMinistry = searchParams?.ministry?.trim() || null
  const requestedLevel = searchParams?.level?.trim() || null
  const activeLevel = VALID_LEVELS.includes(requestedLevel as (typeof VALID_LEVELS)[number])
    ? (requestedLevel as (typeof VALID_LEVELS)[number])
    : null

  const [baseData, filteredData, summary, lastChecked] = await Promise.all([
    getContractPage(page, activeType),
    activeMinistry || activeLevel
      ? getContractPageFiltered(page, activeType, activeMinistry, activeLevel)
      : Promise.resolve(null),
    getMoneyDatasetSummary("contracts"),
    getEtlLastFinished(["contracts_daily", "contracts_backfill"]),
  ])

  const { contracts, total, statsRows } = (activeMinistry || activeLevel) && filteredData
    ? { contracts: filteredData.contracts, total: filteredData.total, statsRows: baseData.statsRows }
    : baseData

  const topAmount = statsRows[0]?.amount ?? null
  const topSum = statsRows.reduce((sum, c) => sum + (c.amount ?? 0), 0)

  return (
    <div className="ui-page">
      <PageHeader
        title="Contratos públicos"
        description="Cada vez que el Estado compra algo —desde un bolígrafo hasta una autopista— tiene que publicarlo. Aquí ves quién compra, a qué empresa, y por cuánto. Ordenados por importe sin IVA."
      />

      {statsRows.length > 0 ? (
        <StatGrid
          items={[
            { label: "Licitaciones publicadas", value: total.toLocaleString("es-ES") },
            {
              label: "Mayor adjudicación",
              value: formatEuroCompact(topAmount),
              hint: "El contrato de mayor importe publicado en la PCSP.",
            },
            {
              label: `Suma · ${statsRows.length.toLocaleString("es-ES")} mayores`,
              value: formatEuroCompact(topSum),
              hint: `Importe agregado de los ${statsRows.length.toLocaleString("es-ES")} contratos más grandes.`,
            },
          ]}
        />
      ) : null}

      <SourceFootnote
        sourceLabel="PCSP · Ministerio de Hacienda"
        sourceHref="https://contrataciondelestado.es"
        lastChecked={lastChecked}
        latestRecordDate={summary.total.latest_record_date}
        coverageLabel={`${total.toLocaleString("es-ES")} licitaciones publicadas`}
      />

      <MoneyDataSummary datasetHref="/contratos" rows={summary.rows} total={summary.total} />

      <ContratosClient
        activeType={activeType}
        activeMinistry={activeMinistry}
        activeLevel={activeLevel}
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
