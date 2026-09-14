import { describe, it, expect, vi } from "vitest"
import { CRITICAL_ETL_PIPELINES } from "@/lib/etl-pipelines"

vi.mock("@/lib/data/etl", () => ({ getEtlPipelineStatus: vi.fn() }))
import { getEtlPipelineStatus } from "@/lib/data/etl"
import { GET } from "./route"

describe("public freshness probe", () => {
  it("fails when the database is unavailable", async () => {
    vi.mocked(getEtlPipelineStatus).mockResolvedValue({ status: "unavailable", pipelines: [] })
    expect((await GET()).status).toBe(503)
  })
  it("fails when a scheduled source is missing", async () => {
    vi.mocked(getEtlPipelineStatus).mockResolvedValue({ status: "ok", pipelines: [] })
    const r = await GET()
    expect(r.status).toBe(503)
    expect((await r.json()).issues.length).toBe(CRITICAL_ETL_PIPELINES.length)
  })
  it("passes only with all scheduled sources fresh", async () => {
    vi.mocked(getEtlPipelineStatus).mockResolvedValue({ status: "ok", pipelines:
      CRITICAL_ETL_PIPELINES.map((spec) => ({ pipeline: spec.pipelines[0],
        last_status: "succeeded", last_finished_at: new Date().toISOString(),
        last_rows_inserted: 0, last_rows_updated: 0, last_error_summary: null })) })
    const r = await GET()
    expect(r.status).toBe(200)
    expect(r.headers.get("Cache-Control")).toBe("no-store")
  })
})
