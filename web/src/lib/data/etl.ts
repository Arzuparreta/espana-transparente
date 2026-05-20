import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"

export const getEtlPipelineStatus = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("v_etl_pipeline_status")
      .select("pipeline, last_status, last_finished_at, last_rows_inserted, last_rows_updated, last_error_summary")
      .order("pipeline")
    return data ?? []
  },
  ["etl-pipeline-status"],
  { revalidate: HOUR }
)

// Returns the most recent successful finished_at across the given pipeline names.
// Useful as `lastChecked` in SourceFootnote.
export const getEtlLastFinished = unstable_cache(
  async (pipelines: string[]): Promise<string | null> => {
    if (pipelines.length === 0) return null
    const { data } = await supabase
      .from("v_etl_pipeline_status")
      .select("last_finished_at")
      .in("pipeline", pipelines)
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
