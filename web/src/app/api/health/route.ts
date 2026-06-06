import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/client"
import { dataErrorMessage, dataQuerySignal } from "@/lib/data/shared"

export const dynamic = "force-dynamic"

export async function GET() {
  const { error } = await supabase
    .from("v_etl_pipeline_status")
    .select("pipeline")
    .limit(1)
    .abortSignal(dataQuerySignal())

  if (error) {
    console.error("health database check failed:", dataErrorMessage(error))
    return NextResponse.json(
      { status: "degraded", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json(
    { status: "ok", database: "ok" },
    { headers: { "Cache-Control": "no-store" } }
  )
}
