import { NextResponse } from "next/server"
import { getEtlFreshnessSummary } from "@/lib/data/home"
import { getCriticalPipelineStatuses, type EtlPipelineRow } from "@/lib/etl-pipelines"
import { supabase } from "@/lib/supabase/client"

export const dynamic = "force-dynamic"

export async function GET() {
  const freshness = await getEtlFreshnessSummary()
  const { data } = await supabase
    .from("v_etl_pipeline_status")
    .select("pipeline, last_finished_at, last_status")
  const rows = (data ?? []) as EtlPipelineRow[]
  const statuses = getCriticalPipelineStatuses(rows)
  return NextResponse.json({
    now: new Date().toISOString(),
    freshness,
    rowCount: rows.length,
    notFresh: statuses.filter((s) => s.status !== "fresh"),
  })
}
