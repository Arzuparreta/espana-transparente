import { describe, expect, it } from "vitest"

import {
  ETL_PIPELINE_LABELS,
  getCriticalPipelineStatuses,
  getEtlPipelineLabel,
  getPipelineDisplayStatus,
} from "./etl-pipelines"

describe("getEtlPipelineLabel", () => {
  it("covers the priority ETL pipelines exposed in status views", () => {
    expect(ETL_PIPELINE_LABELS["congreso.asistencia"]).toBe("Asistencia y votaciones")
    expect(ETL_PIPELINE_LABELS["senado.votaciones"]).toBe("Sesiones Senado")
    expect(ETL_PIPELINE_LABELS["kohesio.fondos_ue"]).toBe("Fondos UE")
    expect(ETL_PIPELINE_LABELS["territorio.org_geolocation"]).toBe("Geolocalización de receptores")
    expect(ETL_PIPELINE_LABELS["ine.ipc_subgrupos"]).toBe("IPC por subgrupos")
    expect(ETL_PIPELINE_LABELS["ine.bde"]).toBe("Deuda pública Eurostat")
    expect(ETL_PIPELINE_LABELS["elections.ingest"]).toBe("Resultados electorales")
    expect(ETL_PIPELINE_LABELS["common.search_refresh"]).toBe("Búsqueda (actualización)")
  })

  it("falls back to the raw pipeline name for unknown entries", () => {
    expect(getEtlPipelineLabel("custom.pipeline")).toBe("custom.pipeline")
  })

  it("marks missing and stale critical pipelines as delayed work", () => {
    const now = new Date("2026-06-09T12:00:00Z")
    const statuses = getCriticalPipelineStatuses(
      [
        {
          pipeline: "contracts_daily",
          last_status: "succeeded",
          last_finished_at: "2026-06-09T04:00:00Z",
        },
        {
          pipeline: "congreso.iniciativas",
          last_status: "succeeded",
          last_finished_at: "2026-05-20T04:00:00Z",
        },
      ],
      now
    )

    expect(statuses.find((row) => row.key === "contracts")?.status).toBe("fresh")
    expect(statuses.find((row) => row.key === "initiatives")?.status).toBe("delayed")
    expect(statuses.find((row) => row.key === "ipc-subgroups")?.status).toBe("missing")
    expect(statuses.find((row) => row.key === "public-debt")?.status).toBe("missing")
    expect(statuses.find((row) => row.key === "receiver-geolocation")?.status).toBe("missing")
    expect(statuses.find((row) => row.key === "deputies")?.status).toBe("missing")
  })

  it("does not report a recent failed run as fresh", () => {
    const row = {
      pipeline: "common.search_refresh",
      last_status: "failed",
      last_finished_at: "2026-06-09T11:55:00Z",
    }
    expect(getPipelineDisplayStatus(row, new Date("2026-06-09T12:00:00Z"))).toBe("failed")
  })
})
