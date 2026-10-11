import {
  getOrganizationFilterName,
  getExplorationTerritoryLabels,
} from "@/lib/data/organizations"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { OperationContext } from "@/components/domain/OperationContext"
import Link from "next/link"
import { SubvencionesClient } from "@/components/subvenciones/SubvencionesClient"
import {
  PAGE_SIZE,
  getEtlLastFinished,
  getMoneyDatasetSummary,
  getSubvencionPage,
  getSubvencionPageFiltered,
  parsePage,
} from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Subvenciones",
  description:
    "Subvenciones públicas concedidas a organizaciones: importe, fecha, administración convocante y beneficiario.",
}

const VALID_NIVELES = ["all", "ESTADO", "AUTONOMICA", "LOCAL"]

interface PageProps {
  searchParams?: Promise<{
    page?: string
    nivel?: string
    ministry?: string
    territory?: string
    year?: string
    province?: string
    municipio?: string
    organization?: string
    role?: string
    flow?: string
  }>
}

export default async function SubvencionesPage({ searchParams }: PageProps) {
  const page = parsePage((await searchParams)?.page)
  const requestedNivel = (await searchParams)?.nivel || "all"
  const activeNivel = VALID_NIVELES.includes(requestedNivel)
    ? requestedNivel
    : "all"
  const activeMinistry = (await searchParams)?.ministry?.trim() || null
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
  const role =
    (await searchParams)?.role === "awarding" ? "awarding" : "recipient"
  const hasFilter = Boolean(
    activeMinistry ||
    activeTerritory ||
    activeYear ||
    activeProvince ||
    activeMunicipio ||
    organization,
  )

  const [
    baseData,
    filteredData,
    summary,
    lastChecked,
    organizationLabel,
    territoryLabels,
  ] = await Promise.all([
    hasFilter
      ? Promise.resolve({ subsidies: [], total: 0 })
      : getSubvencionPage(page, activeNivel),
    hasFilter
      ? getSubvencionPageFiltered(
          page,
          activeNivel,
          activeMinistry,
          activeTerritory,
          activeYear,
          activeProvince,
          activeMunicipio,
          activeFlow,
          organization,
          role,
        )
      : Promise.resolve(null),
    getMoneyDatasetSummary("subsidies"),
    getEtlLastFinished(["subsidies_daily", "subsidies_backfill"]),
    getOrganizationFilterName(organization),
    getExplorationTerritoryLabels(
      [activeTerritory, activeProvince, activeMunicipio].filter(
        (key): key is string => Boolean(key),
      ),
    ),
  ])

  const { subsidies, total } =
    hasFilter && filteredData
      ? {
          subsidies: filteredData.subsidies,
          total: filteredData.total,
        }
      : baseData

  return (
    <div className="ui-page">
      <PageHeader
        title="¿Qué ayudas se concedieron y a quién?"
        description="Consulta las concesiones a organizaciones registradas en la BDNS: importe concedido, beneficiario y órgano concedente. Concesión no equivale a pago. La finalidad procede de la convocatoria verificada."
      />

      <OperationContext kind="subvenciones" total={total} year={activeYear} />
      <p className="my-4 text-sm"><Link className="underline underline-offset-4"
        href={activeYear ? `/ayudas-por-finalidad?year=${activeYear}` : "/ayudas-por-finalidad"}>
        Consultar finalidades e instrumentos del año →
      </Link>{" "}El reparto anual tiene el ámbito del corpus del portal; no aplica los filtros de administración, territorio o beneficiario de esta lista.</p>

      <SourceFootnote
        sourceLabel="BDNS · IGAE"
        sourceHref="https://www.infosubvenciones.es"
        lastChecked={lastChecked}
        latestRecordDate={summary.total.latest_record_date}
        coverageLabel={`Histórico del portal · ${summary.total.total_rows.toLocaleString("es-ES")} concesiones`}
      />

      <SubvencionesClient
        territoryLabels={territoryLabels}
        organizationLabel={organizationLabel}
        activeNivel={activeNivel}
        activeMinistry={activeMinistry}
        activeTerritory={activeTerritory}
        activeYear={activeYear}
        subsidies={subsidies}
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE.subsidies))}
      />

      <InfoPanel title="Fuente">
        Base de Datos Nacional de Subvenciones (BDNS) · Intervención General de
        la Administración del Estado (IGAE). API pública en infosubvenciones.es.
        Solo se muestran concesiones a organizaciones; los beneficiarios
        individuales están anonimizados en la fuente original y no se almacenan.
      </InfoPanel>
    </div>
  )
}
