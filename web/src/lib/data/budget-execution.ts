import { supabase } from "@/lib/supabase/client"
import {
  unstable_cache,
  HOUR,
  dataQuerySignal,
  dataErrorMessage,
} from "./shared"
import {
  executionPeriods,
  type ExecutionObservation,
} from "@/lib/budget-execution"
export const getBudgetExecution = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("budget_execution")
        .select(
          "scope,period,chapter,credit,committed,obligations,payments,unit,raw_data",
        )
        .eq("scope", "ES_STATE_BUDGET")
        .order("period")
        .limit(1000)
        .abortSignal(dataQuerySignal())
      if (error) throw error
      if (!data || data.length >= 1000)
        throw new Error("Incomplete budget execution response")
      return {
        ...executionPeriods(data as ExecutionObservation[]),
        error: false,
      }
    } catch (error) {
      console.error("Budget execution", dataErrorMessage(error))
      return { periods: [], rejectedPeriods: [], error: true }
    }
  },
  ["budget-execution-v1"],
  { revalidate: HOUR },
)
