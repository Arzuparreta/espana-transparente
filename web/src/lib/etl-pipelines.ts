export const ETL_PIPELINE_LABELS: Record<string, string> = {
  "congreso.diputados": "Diputados",
  "congreso.asistencia": "Asistencia y votaciones",
  "congreso.cods": "Expedientes (CODs)",
  "congreso.declaraciones": "Declaraciones económicas",
  "congreso.gobierno": "Gobierno",
  "congreso.responsables": "Responsables",
  "ine.indicadores": "Indicadores INE",
  "contratacion.contratos": "Contratos PCSP",
  "bdns.subvenciones": "Subvenciones BDNS",
  "photos.run": "Fotos",
  "puertas_giratorias": "Puertas giratorias",
  "kohesio.fondos_ue": "Fondos UE",
  "senado.votaciones": "Sesiones Senado",
  "common.search_refresh": "Búsqueda (actualización)",
}

export function getEtlPipelineLabel(pipeline: string): string {
  return ETL_PIPELINE_LABELS[pipeline] ?? pipeline
}
