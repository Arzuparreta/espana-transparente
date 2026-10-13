import { supabase } from "@/lib/supabase/public"
import {
  unstable_cache,
  HOUR,
  PAGE_SIZE,
  throwDataError,
  type SubsidyResponsibilityRow,
} from "./shared"

const getSubsidyCount = unstable_cache(
  async (nivel1: string) => {
    let query = supabase.from("subsidies").select("id", { count: "exact", head: true })
    if (nivel1 !== "all") query = query.eq("nivel1", nivel1)
    const { count, error } = await query
    throwDataError(error, "subsidies count")
    if (count == null) throw new Error("Missing exact subsidies count")
    return count
  }, ["subsidy-count"], { revalidate: HOUR }
)

export const getSubvencionPage = unstable_cache(
  async (page: number, nivel1: string) => {
    const from = (page - 1) * PAGE_SIZE.subsidies
    const to = from + PAGE_SIZE.subsidies - 1

    let query = supabase
      .from("subsidies")
      .select(
        "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url",
      )
      .order("importe", { ascending: false, nullsFirst: false })
      .order("id")

    if (nivel1 !== "all") query = query.eq("nivel1", nivel1)

    const [rows, total] = await Promise.all([
      query.range(from, to),
      getSubsidyCount(nivel1),
    ])
    const { data, error } = rows
    throwDataError(error, "subsidies page")
    const subsidyIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      subsidyIds.length > 0
        ? await supabase
            .from("v_subsidy_responsibility")
            .select(
              "subsidy_id, person_name, politician_id, official_id, ministry, government, political_party, administration_level, territory_name, match_method",
            )
            .in("subsidy_id", subsidyIds)
        : { data: [] }
    throwDataError(
      "error" in responsibilities ? responsibilities.error : null,
      "subsidy responsibilities",
    )

    const responsibleBySubsidy = new Map(
      ((responsibilities.data ?? []) as SubsidyResponsibilityRow[]).map(
        (row) => [
          row.subsidy_id,
          {
            person_name: row.person_name,
            politician_id: row.politician_id,
            official_id: row.official_id,
            ministry: row.ministry,
            government: row.government,
            political_party: row.political_party,
            administration_level: row.administration_level,
            territory_name: row.territory_name,
            match_method: row.match_method,
          },
        ],
      ),
    )

    return {
      subsidies: (data ?? []).map((row) => ({
        ...row,
        responsible: responsibleBySubsidy.get(row.id) ?? null,
      })),
      total,
    }
  },
  ["subsidies-page-v2"],
  { revalidate: HOUR },
)

export const getSubvencionPageFiltered = unstable_cache(
  async (
    page: number,
    nivel1: string,
    ministry: string | null,
    territory: string | null = null,
    year: number | null = null,
    province: string | null = null,
    municipio: string | null = null,
    flow: "by" | "to" = "by",
    organization: string | null = null,
    role: "awarding" | "recipient" = "recipient",
  ) => {
    const from = (page - 1) * PAGE_SIZE.subsidies
    const to = from + PAGE_SIZE.subsidies - 1
    let query = supabase
      .from("subsidies")
      .select(
        "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url",
        { count: "exact" },
      )
      .order("importe", { ascending: false, nullsFirst: false })
      .order("id")

    if (nivel1 !== "all") query = query.eq("nivel1", nivel1)
    if (organization)
      query = query.eq(
        role === "awarding"
          ? "granting_body_organization_id"
          : "beneficiary_organization_id",
        organization,
      )
    if (ministry) query = query.eq("ministry_normalized", ministry)
    // flow="by": granting administration. flow="to": beneficiary location.
    // BDNS publishes no awarding province, so awarding granularity is ccaa/municipio.
    if (flow === "to") {
      if (province) query = query.eq("beneficiary_province_key", province)
      if (municipio) query = query.eq("beneficiary_municipality_key", municipio)
    } else {
      if (territory) query = query.eq("ccaa_key", territory)
      if (municipio) query = query.eq("municipality_key", municipio)
    }
    if (year) {
      query = query
        .gte("fecha_concesion", `${year}-01-01`)
        .lt("fecha_concesion", `${year + 1}-01-01`)
    }

    const { data, count, error } = await query.range(from, to)
    throwDataError(error, "filtered subsidies page")
    const subsidyIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      subsidyIds.length > 0
        ? await supabase
            .from("v_subsidy_responsibility")
            .select(
              "subsidy_id, person_name, politician_id, official_id, ministry, government, political_party, administration_level, territory_name, match_method",
            )
            .in("subsidy_id", subsidyIds)
        : { data: [] }
    throwDataError(
      "error" in responsibilities ? responsibilities.error : null,
      "subsidy responsibilities",
    )

    const responsibleBySubsidy = new Map(
      ((responsibilities.data ?? []) as SubsidyResponsibilityRow[]).map(
        (row) => [
          row.subsidy_id,
          {
            person_name: row.person_name,
            politician_id: row.politician_id,
            official_id: row.official_id,
            ministry: row.ministry,
            government: row.government,
            political_party: row.political_party,
            administration_level: row.administration_level,
            territory_name: row.territory_name,
            match_method: row.match_method,
          },
        ],
      ),
    )

    return {
      subsidies: (data ?? []).map((row) => ({
        ...row,
        responsible: responsibleBySubsidy.get(row.id) ?? null,
      })),
      total: count ?? 0,
    }
  },
  ["subsidy-page-filtered"],
  { revalidate: HOUR },
)

export const getSubsidyDetail = unstable_cache(
  async (id: string) => {
    const [subsidy, responsibility, beneficiary, grantingBody] =
      await Promise.all([
        supabase
          .from("subsidies")
          .select(
            "id, bdns_id, cod_concesion, fecha_concesion, beneficiario, instrumento, importe, convocatoria, numero_convocatoria, nivel1, nivel2, nivel3, beneficiary_organization_id, granting_body_organization_id, source_url, ministry_normalized",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("v_subsidy_mandate_context")
          .select(
            "person_name, politician_id, official_id, ministry, government, political_party, administration_level, territory_name, position_id, position_type, start_date, end_date, mandate_source_url, relation_date, date_basis, match_method, candidate_count",
          )
          .eq("subsidy_id", id)
          .maybeSingle(),
        supabase
          .from("subsidies")
          .select(
            "beneficiary_organization_id, organizations:beneficiary_organization_id(id, name)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("subsidies")
          .select(
            "granting_body_organization_id, organizations:granting_body_organization_id(id, name)",
          )
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
  { revalidate: HOUR },
)
