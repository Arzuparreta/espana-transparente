import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE, throwDataError, type SubsidyResponsibilityRow } from "./shared"

export const getSubvencionPage = unstable_cache(
  async (page: number, nivel1: string) => {
    const from = (page - 1) * PAGE_SIZE.subsidies
    const to = from + PAGE_SIZE.subsidies - 1

    let query = supabase
      .from("subsidies")
      .select(
        "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url",
        { count: "exact" }
      )
      .order("importe", { ascending: false, nullsFirst: false })

    if (nivel1 !== "all") query = query.eq("nivel1", nivel1)

    const { data, count, error } = await query.range(from, to)
    throwDataError(error, "subsidies page")
    const subsidyIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      subsidyIds.length > 0
        ? await supabase
            .from("v_subsidy_responsibility")
            .select("subsidy_id, person_name, politician_id, ministry, government, political_party, administration_level, territory_name, match_method")
            .in("subsidy_id", subsidyIds)
        : { data: [] }
    throwDataError("error" in responsibilities ? responsibilities.error : null, "subsidy responsibilities")

    const responsibleBySubsidy = new Map(
      ((responsibilities.data ?? []) as SubsidyResponsibilityRow[]).map((row) => [
        row.subsidy_id,
        {
          person_name: row.person_name,
          politician_id: row.politician_id,
          ministry: row.ministry,
          government: row.government,
          political_party: row.political_party,
          administration_level: row.administration_level,
          territory_name: row.territory_name,
          match_method: row.match_method,
        },
      ])
    )

    const stats = await supabase
      .from("subsidies")
      .select("id, nivel1, importe")
      .limit(2000)
    throwDataError(stats.error, "subsidy stats")

    return {
      subsidies: (data ?? []).map((row) => ({ ...row, responsible: responsibleBySubsidy.get(row.id) ?? null })),
      total: count ?? 0,
      statsRows: stats.data ?? [],
    }
  },
  ["subsidies-page"],
  { revalidate: HOUR }
)

export const getSubvencionPageFiltered = unstable_cache(
  async (page: number, nivel1: string, ministry: string | null) => {
    const from = (page - 1) * PAGE_SIZE.subsidies
    const to = from + PAGE_SIZE.subsidies - 1
    let query = supabase
      .from("subsidies")
      .select(
        "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url",
        { count: "exact" }
      )
      .order("importe", { ascending: false, nullsFirst: false })

    if (nivel1 !== "all") query = query.eq("nivel1", nivel1)
    if (ministry) query = query.eq("ministry_normalized", ministry)

    const { data, count, error } = await query.range(from, to)
    throwDataError(error, "filtered subsidies page")
    const subsidyIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      subsidyIds.length > 0
        ? await supabase
            .from("v_subsidy_responsibility")
            .select("subsidy_id, person_name, politician_id, ministry, government, political_party, administration_level, territory_name, match_method")
            .in("subsidy_id", subsidyIds)
        : { data: [] }
    throwDataError("error" in responsibilities ? responsibilities.error : null, "subsidy responsibilities")

    const responsibleBySubsidy = new Map(
      ((responsibilities.data ?? []) as SubsidyResponsibilityRow[]).map((row) => [
        row.subsidy_id,
        {
          person_name: row.person_name,
          politician_id: row.politician_id,
          ministry: row.ministry,
          government: row.government,
          political_party: row.political_party,
          administration_level: row.administration_level,
          territory_name: row.territory_name,
          match_method: row.match_method,
        },
      ])
    )

    return {
      subsidies: (data ?? []).map((row) => ({ ...row, responsible: responsibleBySubsidy.get(row.id) ?? null })),
      total: count ?? 0,
    }
  },
  ["subsidy-page-filtered"],
  { revalidate: HOUR }
)

export const getSubsidyDetail = unstable_cache(
  async (id: string) => {
    const [subsidy, responsibility, beneficiary, grantingBody] = await Promise.all([
      supabase
        .from("subsidies")
        .select(
          "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, numero_convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url, ministry_normalized"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("v_subsidy_responsibility")
        .select("person_name, politician_id, ministry, government, political_party, administration_level, territory_name")
        .eq("subsidy_id", id)
        .maybeSingle(),
      supabase
        .from("subsidies")
        .select("beneficiary_organization_id, organizations:beneficiary_organization_id(id, name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("subsidies")
        .select("granting_body_organization_id, organizations:granting_body_organization_id(id, name)")
        .eq("id", id)
        .maybeSingle(),
    ])
    throwDataError(subsidy.error, "subsidy detail")
    throwDataError(responsibility.error, "subsidy responsibility")
    throwDataError(beneficiary.error, "subsidy beneficiary")
    throwDataError(grantingBody.error, "subsidy granting body")
    const benRaw = beneficiary.data?.organizations as unknown
    const grantRaw = grantingBody.data?.organizations as unknown
    const pickOrg = (raw: unknown): { id: string; name: string } | null => {
      if (!raw) return null
      const obj = Array.isArray(raw) ? raw[0] : raw
      return (obj as { id: string; name: string }) ?? null
    }
    return {
      subsidy: subsidy.data,
      responsible: responsibility.data ?? null,
      beneficiaryOrg: pickOrg(benRaw),
      grantingOrg: pickOrg(grantRaw),
    }
  },
  ["subsidy-detail"],
  { revalidate: HOUR }
)
