import { supabase } from "@/lib/supabase/public"
import {
  unstable_cache,
  HOUR,
  dataErrorMessage,
  dataQuerySignal,
} from "./shared"
import { validateDusSnapshot } from "@/lib/prtr-program"
export const getDusProgram = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("prtr_program_snapshot")
        .select("metadata")
        .eq("program", "DUS5000")
        .abortSignal(dataQuerySignal())
        .maybeSingle()
      if (error) throw error
      if (!data) return { snapshot: null, error: false }
      const snapshot = validateDusSnapshot(data.metadata)
      if (!snapshot) throw new Error("Invalid DUS5000 edition")
      return { snapshot, error: false }
    } catch (error) {
      console.error("DUS5000", dataErrorMessage(error))
      return { snapshot: null, error: true }
    }
  },
  ["prtr-dus5000-v1"],
  { revalidate: HOUR },
)
