import { supabase } from "@/lib/supabase/client"
import {
  unstable_cache,
  HOUR,
  dataQuerySignal,
  dataErrorMessage,
} from "./shared"
import { validateWaitingSnapshot } from "@/lib/service-waiting"
export const getServiceWaiting = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("service_waiting_snapshot")
        .select("metadata")
        .eq("scope", "sisle-surgery")
        .abortSignal(dataQuerySignal())
        .maybeSingle()
      if (error) throw error
      if (!data) return { snapshot: null, error: false }
      const snapshot = validateWaitingSnapshot(data.metadata)
      if (!snapshot) throw new Error("Invalid SISLE snapshot")
      return { snapshot, error: false }
    } catch (error) {
      console.error("SISLE waiting", dataErrorMessage(error))
      return { snapshot: null, error: true }
    }
  },
  ["service-waiting-v1"],
  { revalidate: HOUR },
)
