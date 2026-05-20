import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"

export type MultilevelSummary = {
  subsidyCount: number
  subsidyLatestDate: string | null
  contractCount: number
  contractLatestDate: string | null
}

async function fetchMultilevelSummary(
  subsidyNivel1: string,
  contractLevel: string
): Promise<MultilevelSummary> {
  const [subsidyCountRes, subsidyLatestRes, contractCountRes, contractLatestRes] =
    await Promise.all([
      supabase
        .from("subsidies")
        .select("id", { count: "exact", head: true })
        .eq("nivel1", subsidyNivel1),
      supabase
        .from("subsidies")
        .select("fecha_concesion")
        .eq("nivel1", subsidyNivel1)
        .order("fecha_concesion", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("administration_level", contractLevel),
      supabase
        .from("contracts")
        .select("date")
        .eq("administration_level", contractLevel)
        .order("date", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ])

  return {
    subsidyCount: subsidyCountRes.count ?? 0,
    subsidyLatestDate: (subsidyLatestRes.data?.fecha_concesion as string | null) ?? null,
    contractCount: contractCountRes.count ?? 0,
    contractLatestDate: (contractLatestRes.data?.date as string | null) ?? null,
  }
}

export const getAutonomicSummary = unstable_cache(
  () => fetchMultilevelSummary("AUTONOMICA", "autonomic"),
  ["multilevel-autonomic"],
  { revalidate: HOUR }
)

export const getMunicipalSummary = unstable_cache(
  () => fetchMultilevelSummary("LOCAL", "municipal"),
  ["multilevel-municipal"],
  { revalidate: HOUR }
)
