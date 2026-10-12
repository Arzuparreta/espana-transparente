import { supabase } from "@/lib/supabase/client"
import {
  unstable_cache,
  HOUR,
  dataErrorMessage,
  dataQuerySignal,
} from "./shared"
import { validateCohesionSnapshot } from "@/lib/cohesion-program"
export const getCohesionProgrammes = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("cohesion_program_snapshot")
        .select("metadata")
        .eq("scope", "ES_ERDF_2014_2020")
        .abortSignal(dataQuerySignal())
        .maybeSingle()
      if (error) throw error
      if (!data) return { snapshot: null, error: false }
      const snapshot = validateCohesionSnapshot(data.metadata)
      if (!snapshot) throw new Error("Invalid FEDER source edition")
      return { snapshot, error: false }
    } catch (error) {
      console.error("Cohesion programmes", dataErrorMessage(error))
      return { snapshot: null, error: true }
    }
  },
  ["cohesion-programmes-v1"],
  { revalidate: HOUR },
)
