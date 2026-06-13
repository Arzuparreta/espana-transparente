import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
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
import { formatEuroCompact } from "@/lib/format"

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
    territory?: string
    year?: string
  }
}

export default async function SubvencionesPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const requestedNivel = searchParams?.nivel || "all"
  const activeNivel = VALID_NIVELES.includes(requestedNivel) ? requestedNivel : "all"
  const activeMinistry = searchParams?.ministry?.trim() || null
  const activeTerritory = searchParams?.territory?.trim() || null
  const requestedYear = Number.parseInt(searchParams?.year ?? "", 10)
  const activeYear = Number.isFinite(requestedYear) ? requestedYear : null

  const [baseData, filteredData, summary, lastChecked] = await Promise.all([
    getSubvencionPage(page, activeNivel),
    activeMinistry || activeTerritory || activeYear
      ? getSubvencionPageFiltered(page, activeNivel, activeMinistry, activeTerritory, activeYear)
      : Promise.resolve(null),
    getMoneyDatasetSummary("subsidies"),
    getEtlLastFinished(["subsidies_daily", "subsidies_backfill"]),
  ])

  const { subsidies, total, statsRows } = (activeMinistry || activeTerritory || activeYear) && filteredData
    ? { subsidies: filteredData.subsidies, total: filteredData.total, statsRows: baseData.statsRows }
    : baseData

  const topImporte = (statsRows[0] as { importe?: number } | undefined)?.importe ?? null
  const topSum = statsRows.reduce((sum, s) => sum + ((s as { importe?: number }).importe ?? 0), 0)

  return (
    <div className="ui-page">
      <PageHeader
        title="Subvenciones"
        description="Dinero que reparte el Estado a empresas, fundaciones u organismos para fines concretos. Quién lo recibe, cuánto, y para qué. Beneficiarios individuales aparecen anonimizados en la fuente oficial."
      />

      {statsRows.length > 0 ? (
        <StatGrid
          items={[
            { label: "Concesiones publicadas", value: total.toLocaleString("es-ES") },
            {
              label: "Mayor concesión",
              value: formatEuroCompact(topImporte),
              hint: "La subvención de mayor importe publicada en la BDNS.",
            },
            {
              label: `Suma · ${statsRows.length.toLocaleString("es-ES")} mayores`,
              value: formatEuroCompact(topSum),
              hint: `Importe agregado de las ${statsRows.length.toLocaleString("es-ES")} concesiones más grandes.`,
            },
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

      <SubvencionesClient
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
        Base de Datos Nacional de Subvenciones (BDNS) · Intervención General de la Administración del Estado (IGAE).
        API pública en infosubvenciones.es. Solo se muestran concesiones a organizaciones; los beneficiarios individuales
        están anonimizados en la fuente original y no se almacenan.
      </InfoPanel>
    </div>
  )
}
