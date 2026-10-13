import { supabase } from "@/lib/supabase/public"
import { unstable_cache, HOUR, dataErrorMessage, dataQuerySignal } from "./shared"
import { mrrSnapshot } from "@/lib/mrr-instruments"
export const getMrrInstruments = unstable_cache(async () => {
  try {
    const { data, error } = await supabase.from("mrr_instrument_snapshot").select("metadata").eq("scope", "ico-2026").abortSignal(dataQuerySignal()).maybeSingle()
    if (error) throw error
    if (!data) return { snapshot: null, error: false }
    const snapshot = mrrSnapshot(data.metadata)
    if (!snapshot) throw new Error("Invalid published MRR commitment edition")
    return { snapshot, error: false }
  } catch (error) {
    console.error("MRR commitments", dataErrorMessage(error))
    return { snapshot: null, error: true }
  }
}, ["mrr-instruments-2026-v1"], { revalidate: HOUR })
