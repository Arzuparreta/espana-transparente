import { NextResponse } from "next/server"
import { getEtlPipelineStatus } from "@/lib/data/etl"
import { getCriticalPipelineStatuses } from "@/lib/etl-pipelines"

export const dynamic = "force-dynamic"

export async function GET() {
  const result = await getEtlPipelineStatus()
  const pipelines = getCriticalPipelineStatuses(result.pipelines)
  const issues = pipelines.filter((row) => row.status !== "fresh")
  const ok = result.status === "ok" && issues.length === 0
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checkedAt: new Date().toISOString(),
      database: result.status, monitored: pipelines.length, issues },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  )
}
