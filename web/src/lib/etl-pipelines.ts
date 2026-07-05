export const ETL_PIPELINE_LABELS: Record<string, string> = {
  "congreso.diputados": "Diputados",
  "congreso.asistencia": "Asistencia y votaciones",
  "congreso.cods": "Expedientes (CODs)",
  "congreso.declaraciones": "Declaraciones económicas",
  "congreso.declaraciones_ocr": "Declaraciones OCR",
  "congreso.gobierno": "Gobierno",
  "congreso.iniciativas": "Iniciativas legislativas",
  "congreso.opendata_intereses": "Intereses (OpenData)",
  "congreso.power_relationships": "Relaciones de poder",
  "congreso.public_officials": "Cargos públicos",
  "congreso.responsables": "Responsables",
  "ine.indicadores": "Indicadores INE",
  "ine.indicadores_ampliados": "Indicadores ampliados INE",
  "ine.ipc_subgrupos": "IPC por subgrupos",
  "ine.bde": "Deuda pública Eurostat",
  "contratacion.contratos": "Contratos PCSP",
  "contracts_daily": "Contratos PCSP",
  "contracts_backfill": "Contratos PCSP (histórico)",
  "bdns.subvenciones": "Subvenciones BDNS",
  "subsidies_daily": "Subvenciones BDNS",
  "subsidies_backfill": "Subvenciones BDNS (histórico)",
  "photos.run": "Fotos",
  "photos.public_officials_wikidata": "Fotos de cargos públicos",
  "puertas_giratorias.ingest": "Puertas giratorias",
  "kohesio.fondos_ue": "Fondos UE",
  "presupuestos.presupuestos": "Presupuestos",
  "presupuestos": "Presupuestos",
  "territorio.atlas": "Atlas territorial",
  "territorio.municipios": "Catálogo municipal",
  "territorio.org_geolocation": "Geolocalización de receptores",
  "senado.senadores": "Senadores",
  "senado.bajas": "Bajas del Senado",
  "senado.votaciones": "Sesiones Senado",
  "instituciones.instituciones": "Instituciones",
  "public_bodies.boe_nombramientos": "Nombramientos BOE",
  "borme.officers": "Administradores BORME",
  "lobbying.rgi": "Registro de lobbies",
  "judicial.wikipedia": "Causas judiciales (Wikipedia)",
  "judicial.cgpj": "Causas judiciales (CGPJ)",
  "judicial.contract_links": "Vínculos judiciales con gasto",
  "elections.ingest": "Resultados electorales",
  "common.search_refresh": "Búsqueda (actualización)",
}

export function getEtlPipelineLabel(pipeline: string): string {
  return ETL_PIPELINE_LABELS[pipeline] ?? pipeline
}

export type EtlPipelineRow = {
  pipeline: string
  last_status: string | null
  last_finished_at: string | null
}

export type CriticalPipelineStatus = {
  key: string
  label: string
  cadence: "daily" | "weekly"
  maxAgeHours: number
  status: "fresh" | "delayed" | "failed" | "missing"
  pipeline: string | null
  finishedAt: string | null
}

export const CRITICAL_ETL_PIPELINES = [
  {
    key: "deputies",
    label: "Diputados",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["congreso.diputados"],
  },
  {
    key: "attendance",
    label: "Asistencia y votaciones",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["congreso.asistencia"],
  },
  {
    key: "indicators",
    label: "Indicadores económicos",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["ine.indicadores"],
  },
  {
    key: "expanded-indicators",
    label: "Indicadores ampliados",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["ine.indicadores_ampliados"],
  },
  {
    key: "ipc-subgroups",
    label: "IPC por subgrupos",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["ine.ipc_subgrupos"],
  },
  {
    key: "public-debt",
    label: "Deuda pública",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["ine.bde"],
  },
  {
    key: "contracts",
    label: "Contratos",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["contracts_daily", "contratacion.contratos"],
  },
  {
    key: "subsidies",
    label: "Subvenciones",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["subsidies_daily", "bdns.subvenciones"],
  },
  {
    key: "search",
    label: "Búsqueda",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["common.search_refresh"],
  },
  {
    key: "territory-atlas",
    label: "Atlas territorial",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["territorio.atlas"],
  },
  {
    key: "receiver-geolocation",
    label: "Geolocalización de receptores",
    cadence: "daily",
    maxAgeHours: 36,
    pipelines: ["territorio.org_geolocation"],
  },
  {
    key: "initiatives",
    label: "Iniciativas legislativas",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["congreso.iniciativas"],
  },
  {
    key: "budgets",
    label: "Presupuestos",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["presupuestos", "presupuestos.presupuestos"],
  },
  {
    key: "eu-funds",
    label: "Fondos UE",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["kohesio.fondos_ue"],
  },
  {
    key: "senate-members",
    label: "Senadores",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["senado.senadores"],
  },
  {
    key: "senate-votes",
    label: "Votaciones del Senado",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["senado.votaciones"],
  },
  {
    key: "judicial-wikipedia",
    label: "Causas judiciales",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["judicial.wikipedia"],
  },
  {
    key: "judicial-cgpj",
    label: "Datos judiciales CGPJ",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["judicial.cgpj"],
  },
  {
    key: "judicial-links",
    label: "Vínculos judiciales con gasto",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["judicial.contract_links"],
  },
  {
    key: "elections",
    label: "Resultados electorales",
    cadence: "weekly",
    maxAgeHours: 24 * 9,
    pipelines: ["elections.ingest"],
  },
] as const

function newestRow(rows: EtlPipelineRow[], pipelines: readonly string[]) {
  return rows
    .filter((row) => pipelines.includes(row.pipeline))
    .sort((a, b) => {
      const aTime = a.last_finished_at ? Date.parse(a.last_finished_at) : 0
      const bTime = b.last_finished_at ? Date.parse(b.last_finished_at) : 0
      return bTime - aTime
    })[0] ?? null
}

export function getCriticalPipelineStatuses(
  rows: EtlPipelineRow[],
  now = new Date()
): CriticalPipelineStatus[] {
  return CRITICAL_ETL_PIPELINES.map((spec) => {
    const row = newestRow(rows, spec.pipelines)
    if (!row?.last_finished_at) {
      return { ...spec, status: "missing", pipeline: row?.pipeline ?? null, finishedAt: null }
    }
    if (row.last_status === "failed") {
      return { ...spec, status: "failed", pipeline: row.pipeline, finishedAt: row.last_finished_at }
    }

    const finishedAt = Date.parse(row.last_finished_at)
    const ageHours = (now.getTime() - finishedAt) / 3_600_000
    const status =
      row.last_status === "succeeded" &&
      Number.isFinite(ageHours) &&
      ageHours <= spec.maxAgeHours
        ? "fresh"
        : "delayed"

    return { ...spec, status, pipeline: row.pipeline, finishedAt: row.last_finished_at }
  })
}

export function getPipelineDisplayStatus(
  row: EtlPipelineRow,
  now = new Date()
): "ok" | "delayed" | "failed" | "unknown" {
  if (row.last_status === "failed") return "failed"
  if (row.last_status !== "succeeded") return "unknown"

  const spec = CRITICAL_ETL_PIPELINES.find((item) =>
    item.pipelines.some((pipeline) => pipeline === row.pipeline)
  )
  if (!spec || !row.last_finished_at) return "ok"

  const ageHours = (now.getTime() - Date.parse(row.last_finished_at)) / 3_600_000
  return Number.isFinite(ageHours) && ageHours <= spec.maxAgeHours ? "ok" : "delayed"
}
