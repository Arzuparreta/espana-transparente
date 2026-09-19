import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"
import {
  FISCAL_SERIES,
  fiscalYears,
  type FiscalObservation,
} from "@/lib/fiscal"
export const getFiscalAccounts = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("economic_indicators")
      .select("indicator_code,period,value,unit,raw_data")
      .in("indicator_code", Object.keys(FISCAL_SERIES))
      .gte("period", "2016")
      .order("period")
      .limit(1000)
    if (error) {
      console.error("fiscal accounts", error.message)
      return { years: [], lastChecked: null, error: true }
    }
    const rows = (data ?? []) as FiscalObservation[]
    const checked = rows
      .map((r) => r.raw_data?.retrieved_at)
      .filter((v): v is string => typeof v === "string")
      .sort()
    return {
      years: fiscalYears(rows),
      lastChecked: checked.at(0) ?? null,
      error: false,
    }
  },
  ["fiscal-accounts-v1"],
  { revalidate: HOUR },
)
