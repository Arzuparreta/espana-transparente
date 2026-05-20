import { describe, expect, it } from "vitest"

import { ETL_PIPELINE_LABELS, getEtlPipelineLabel } from "./etl-pipelines"

describe("getEtlPipelineLabel", () => {
  it("covers the priority ETL pipelines exposed in status views", () => {
    expect(ETL_PIPELINE_LABELS["congreso.asistencia"]).toBe("Asistencia y votaciones")
    expect(ETL_PIPELINE_LABELS["senado.votaciones"]).toBe("Sesiones Senado")
    expect(ETL_PIPELINE_LABELS["kohesio.fondos_ue"]).toBe("Fondos UE")
    expect(ETL_PIPELINE_LABELS["common.search_refresh"]).toBe("Búsqueda (actualización)")
  })

  it("falls back to the raw pipeline name for unknown entries", () => {
    expect(getEtlPipelineLabel("custom.pipeline")).toBe("custom.pipeline")
  })
})
