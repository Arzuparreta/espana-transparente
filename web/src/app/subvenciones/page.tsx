import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { MoneyDataSummary } from "@/components/domain/MoneyDataSummary"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
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
  description: "Subvenciones públicas concedidas a organizaciones: importe, fecha, administración convocante y beneficiario.",
}

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

  const [baseData, filteredData, summary, lastChecked] = await Promise.all([
    getSubvencionPage(page, activeNivel),
    activeMinistry ? getSubvencionPageFiltered(page, activeNivel, activeMinistry) : Promise.resolve(null),
    getMoneyDatasetSummary("subsidies"),
    getEtlLastFinished(["subsidies_daily", "subsidies_backfill"]),
  ])

  const { subsidies, total, statsRows } = activeMinistry && filteredData
    ? { subsidies: filteredData.subsidies, total: filteredData.total, statsRows: baseData.statsRows }
    : baseData

  const totalAmount = statsRows.reduce((sum, s) => sum + ((s as { importe?: number }).importe ?? 0), 0)
  const formatted =
    totalAmount >= 1_000_000_000
      ? `${(totalAmount / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
      : `${(totalAmount / 1_000_000).toFixed(0)}M €`

  const uniqueOrganos = new Set(statsRows.map((s) => (s as { nivel3?: string }).nivel3).filter(Boolean)).size

  return (
    <div className="ui-page">
      <PageHeader
        title="Subvenciones"
        description="Dinero que reparte el Estado a empresas, fundaciones u organismos para fines concretos. Quién lo recibe, cuánto, y para qué. Beneficiarios individuales aparecen anonimizados en la fuente oficial."
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

      <SourceFootnote
        sourceLabel="BDNS · IGAE"
        sourceHref="https://www.infosubvenciones.es"
        lastChecked={lastChecked}
        latestRecordDate={summary.total.latest_record_date}
        coverageLabel={`${total.toLocaleString("es-ES")} concesiones publicadas`}
      />

      <MoneyDataSummary datasetHref="/subvenciones" rows={summary.rows} total={summary.total} />

      <SubvencionesClient
        activeNivel={activeNivel}
        activeMinistry={activeMinistry}
        subsidies={subsidies}
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE.subsidies))}
      />

      <InfoPanel title="Fuente">
        Base de Datos Nacional de Subvenciones (BDNS) · Intervención General de la Administración del Estado (IGAE).
        API pública en infosubvenciones.es. Solo se muestran concesiones a organizaciones; los beneficiarios individuales
        están anonimizados en la fuente original y no se almacenan.
      </InfoPanel>
    </div>
  )
}
