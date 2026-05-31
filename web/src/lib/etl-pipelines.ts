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
  "congreso.responsables": "Responsables",
  "ine.indicadores": "Indicadores INE",
  "ine.indicadores_ampliados": "Indicadores ampliados INE",
  "contratacion.contratos": "Contratos PCSP",
  "bdns.subvenciones": "Subvenciones BDNS",
  "photos.run": "Fotos",
  "puertas_giratorias.ingest": "Puertas giratorias",
  "kohesio.fondos_ue": "Fondos UE",
  "presupuestos.presupuestos": "Presupuestos",
  "senado.senadores": "Senadores",
  "senado.bajas": "Bajas del Senado",
  "senado.votaciones": "Sesiones Senado",
  "instituciones.instituciones": "Instituciones",
  "public_bodies.boe_nombramientos": "Nombramientos BOE",
  "borme.officers": "Administradores BORME",
  "lobbying.rgi": "Registro de lobbies",
  "judicial.wikipedia": "Causas judiciales (Wikipedia)",
  "judicial.cgpj": "Causas judiciales (CGPJ)",
  "common.search_refresh": "Búsqueda (actualización)",
}

export function getEtlPipelineLabel(pipeline: string): string {
  return ETL_PIPELINE_LABELS[pipeline] ?? pipeline
}
