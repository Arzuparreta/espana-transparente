import { supabase } from "@/lib/supabase/public"
import {
  unstable_cache,
  HOUR,
  dataQuerySignal,
  dataErrorMessage,
} from "./shared"
import { sectorYears, type SectorObservation } from "@/lib/fiscal-sectors"
export const getFiscalSectors = unstable_cache(
  async () => {
    try {
      const { data, error } = await supabase
        .from("fiscal_sector_accounts")
        .select("geo,sector,year,item,value,unit,raw_data")
        .eq("geo", "ES")
        .gte("year", 2016)
        .order("year")
        .limit(1500)
        .abortSignal(dataQuerySignal())
      if (error) throw error
      if (!data || data.length >= 1500)
        throw new Error("Incomplete sector snapshot")
      return { ...sectorYears(data as SectorObservation[]), error: false }
    } catch (error) {
      console.error("Fiscal sector snapshot", dataErrorMessage(error))
      return { years: [], rejectedYears: [], error: true }
    }
  },
  ["fiscal-sector-accounts-v1"],
  { revalidate: HOUR },
)
