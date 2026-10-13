import { supabase } from "@/lib/supabase/public"
import {
  unstable_cache,
  HOUR,
  dataQuerySignal,
  dataErrorMessage,
} from "./shared"
import { decodePurposeGroups, type BdnsCall } from "@/lib/subsidy-purpose"

export const getSubsidyPurposeYear = unstable_cache(
  async (year: number) => {
    try {
      if (!Number.isInteger(year) || year < 2014 || year > 2100)
        throw new Error("Invalid year")
      const { data, error } = await supabase
        .rpc("subsidy_purpose_year", { p_year: year })
        .limit(1000)
        .abortSignal(dataQuerySignal())
      if (error) throw error
      if (!data || data.length >= 1000)
        throw new Error("Incomplete purpose query")
      return { groups: decodePurposeGroups(data), error: false }
    } catch (error) {
      console.error("BDNS purpose aggregate", dataErrorMessage(error))
      return { groups: [], error: true }
    }
  },
  ["subsidy-purposes-year-v1"],
  { revalidate: HOUR },
)

export const getBdnsCall = unstable_cache(
  async (code: string | null) => {
    if (!code || !/^[0-9]{1,20}$/.test(code))
      return { call: null, error: false }
    try {
      const { data, error } = await supabase
        .from("bdns_calls")
        .select(
          "numero_convocatoria,title,finalidad,tipo_convocatoria,source_url,checked_at",
        )
        .eq("numero_convocatoria", code)
        .abortSignal(dataQuerySignal())
        .maybeSingle()
      if (error) throw error
      return { call: data as BdnsCall | null, error: false }
    } catch (error) {
      console.error("BDNS call lookup", dataErrorMessage(error))
      return { call: null, error: true }
    }
  },
  ["bdns-call-v1"],
  { revalidate: HOUR },
)
