import { supabase } from "@/lib/supabase/client"
import { dataErrorMessage, dataQuerySignal, unstable_cache, HOUR } from "./shared"

export async function getEtlPipelineStatus() {
  try {
    const { data, error } = await supabase
      .from("v_etl_pipeline_status")
      .select("pipeline, last_status, last_finished_at, last_rows_inserted, last_rows_updated, last_error_summary")
      .order("pipeline")
      .abortSignal(dataQuerySignal())
    if (error) {
      console.error("getEtlPipelineStatus error:", dataErrorMessage(error))
      throw new Error("ETL pipeline status data source unavailable")
    }
    return { status: "ok" as const, pipelines: data ?? [] }
  } catch (error) {
    console.error("getEtlPipelineStatus unavailable:", dataErrorMessage(error))
    return { status: "unavailable" as const, pipelines: [] }
  }
}

// Returns the most recent finished_at across the given pipeline names.
// Useful as `lastChecked` in SourceFootnote.
const getEtlLastFinishedCached = unstable_cache(
  async (pipelines: string[]): Promise<string | null> => {
    if (pipelines.length === 0) return null
    const { data, error } = await supabase
      .from("v_etl_pipeline_status")
      .select("last_finished_at")
      .in("pipeline", pipelines)
      .abortSignal(dataQuerySignal())
    if (error) {
      console.error("getEtlLastFinished error:", dataErrorMessage(error))
      throw new Error("ETL freshness data source unavailable")
    }
    if (!data || data.length === 0) return null
    const dates = data
      .map((r) => (r.last_finished_at as string | null) ?? null)
      .filter((d): d is string => Boolean(d))
      .sort()
    return dates.at(-1) ?? null
  },
  ["etl-last-finished"],
  { revalidate: HOUR }
)

export async function getEtlLastFinished(pipelines: string[]): Promise<string | null> {
  try {
    return await getEtlLastFinishedCached(pipelines)
  } catch (error) {
    console.error("getEtlLastFinished unavailable:", dataErrorMessage(error))
    return null
  }
}
