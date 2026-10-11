import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"
import { cofogYears, type CofogObservation } from "@/lib/cofog"

export const getExpenditureFunctions = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("expenditure_functions")
      .select("geo,sector,year,function_code,value,unit,raw_data")
      .eq("geo", "ES")
      .eq("sector", "S13")
      .gte("year", 2016)
      .order("year")
      .limit(1000)
    if (error) {
      console.error("COFOG snapshot", error.message)
      return { years: [], rejectedYears: [], error: true }
    }
    return { ...cofogYears((data ?? []) as CofogObservation[]), error: false }
  },
  ["expenditure-functions-v1"],
  { revalidate: HOUR },
)
