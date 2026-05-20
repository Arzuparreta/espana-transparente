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
