import {
  getOrganizationFilterName,
  getExplorationTerritoryLabels,
} from "@/lib/data/organizations"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { OperationContext } from "@/components/domain/OperationContext"
import { ContratosClient } from "@/components/contratos/ContratosClient"
import { ContractPurchaseAnswer } from "@/components/contratos/ContractPurchaseAnswer"
import { getContractPurchases } from "@/lib/data/contract-purchases"
import { selectPurchaseLevel } from "@/lib/contract-purchases"
import {
  PAGE_SIZE,
  getContractPage,
  getContractPageFiltered,
  getEtlLastFinished,
  getMoneyDatasetSummary,
  parsePage,
} from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Contratos públicos",
  description:
    "Licitaciones y adjudicaciones publicadas: presupuesto sin IVA, estado del expediente, órgano contratante y adjudicatario.",
}

const VALID_LEVELS = ["state", "autonomic", "municipal"] as const

interface PageProps {
  searchParams?: Promise<{
    page?: string
    type?: string
    ministry?: string
    level?: string
    territory?: string
    year?: string
    province?: string
    municipio?: string
    organization?: string
    role?: string
    flow?: string
    award_year?: string
    award_level?: string
  }>
}

export default async function ContratosPage({ searchParams }: PageProps) {
  const page = parsePage((await searchParams)?.page)
  const requestedType = (await searchParams)?.type || "all"
  const activeType = ["all", "Servicios", "Obras", "Suministros"].includes(
    requestedType,
  )
    ? requestedType
    : "all"
  const activeMinistry = (await searchParams)?.ministry?.trim() || null
  const requestedLevel = (await searchParams)?.level?.trim() || null
  const activeLevel = VALID_LEVELS.includes(
    requestedLevel as (typeof VALID_LEVELS)[number],
  )
    ? (requestedLevel as (typeof VALID_LEVELS)[number])
    : null
  const activeTerritory = (await searchParams)?.territory?.trim() || null
  const activeProvince = (await searchParams)?.province?.trim() || null
  const activeMunicipio = (await searchParams)?.municipio?.trim() || null
  const activeFlow = (await searchParams)?.flow === "to" ? "to" : "by"
  const requestedYear = Number((await searchParams)?.year ?? "")
  const activeYear =
    Number.isInteger(requestedYear) &&
    requestedYear >= 1900 &&
    requestedYear <= 2100
      ? requestedYear
      : null

  const organizationInput = (await searchParams)?.organization ?? ""
  const organization =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      organizationInput,
    )
      ? organizationInput
      : null
  const roleInput = (await searchParams)?.role
  const role =
    roleInput === "awarding" || roleInput === "recipient" ? roleInput : "all"
  const hasFilter = Boolean(
    activeMinistry ||
    activeLevel ||
    activeTerritory ||
    activeYear ||
    activeProvince ||
    activeMunicipio ||
    organization,
  )

  const purchaseLevel = selectPurchaseLevel((await searchParams)?.award_level)
  const [
    purchases,
    baseData,
    filteredData,
    summary,
    lastChecked,
    organizationLabel,
    territoryLabels,
  ] = await Promise.all([
    getContractPurchases((await searchParams)?.award_year),
    hasFilter
      ? Promise.resolve({ contracts: [], total: 0 })
      : getContractPage(page, activeType),
    hasFilter
      ? getContractPageFiltered(
          page,
          activeType,
          activeMinistry,
          activeLevel,
          activeTerritory,
          activeYear,
          activeProvince,
          activeMunicipio,
          activeFlow,
          organization,
          role,
        )
      : Promise.resolve(null),
    getMoneyDatasetSummary("contracts"),
    getEtlLastFinished(["contracts_daily", "contracts_backfill"]),
    getOrganizationFilterName(organization),
    getExplorationTerritoryLabels(
      [activeTerritory, activeProvince, activeMunicipio].filter(
        (key): key is string => Boolean(key),
      ),
    ),
  ])

  const { contracts, total } =
    hasFilter && filteredData
      ? {
          contracts: filteredData.contracts,
          total: filteredData.total,
        }
      : baseData

  return (
    <div className="ui-page">
      <PageHeader
        title="¿Qué se compra y a quién se adjudica?"
        description="Consulta las licitaciones registradas en la PCSP, su órgano contratante y su estado. El presupuesto de licitación y el importe adjudicado son medidas distintas; ninguno acredita un pago."
      />

      <ContractPurchaseAnswer data={purchases} level={purchaseLevel} />

      <h2 className="text-xl font-semibold">Expedientes registrados</h2>

      <OperationContext kind="contratos" total={total} year={activeYear} />

      <SourceFootnote
        sourceLabel="PCSP · Ministerio de Hacienda"
        sourceHref="https://contrataciondelestado.es"
        lastChecked={lastChecked}
        latestRecordDate={summary.total.latest_record_date}
        coverageLabel={`Histórico del portal · ${summary.total.total_rows.toLocaleString("es-ES")} licitaciones`}
      />

      <ContratosClient
        territoryLabels={territoryLabels}
        organizationLabel={organizationLabel}
        activeType={activeType}
        activeMinistry={activeMinistry}
        activeLevel={activeLevel}
        activeTerritory={activeTerritory}
        activeYear={activeYear}
        contracts={contracts}
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE.contracts))}
      />

      <InfoPanel title="Fuente">
        Plataforma de Contratación del Sector Público (PCSP) · Ministerio de
        Hacienda. Consulta automática diaria de las licitaciones publicadas en
        la PCSP. La fecha de cada registro corresponde a su actualización en la
        fuente.
      </InfoPanel>
    </div>
  )
}
