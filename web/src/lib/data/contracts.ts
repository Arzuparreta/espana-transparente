import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE, throwDataError, type ContractResponsibilityRow } from "./shared"

export const getContractPage = unstable_cache(
  async (page: number, type: string) => {
    const from = (page - 1) * PAGE_SIZE.contracts
    const to = from + PAGE_SIZE.contracts - 1
    let query = supabase
      .from("contracts")
      .select(
        "id, contract_folder_id, title, awarding_body, awarding_body_organization_id, amount, status, contract_type, region, date, source_url, contractor, contractor_nif, contractor_is_sme, contractor_is_ute, award_amount, award_amount_with_taxes, award_date, contract_number, received_tender_quantity",
        { count: "exact" }
      )
      .order("amount", { ascending: false, nullsFirst: false })

    if (type !== "all") query = query.eq("contract_type", type)

    const { data, count, error } = await query.range(from, to)
    throwDataError(error, "contracts page")
    const contractIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      contractIds.length > 0
        ? await supabase
            .from("v_contract_responsibility")
            .select("contract_id, person_name, politician_id, official_id, ministry, government, political_party, administration_level, territory_name, match_method")
            .in("contract_id", contractIds)
        : { data: [] }
    throwDataError("error" in responsibilities ? responsibilities.error : null, "contract responsibilities")

    const responsibleByContract = new Map(
      ((responsibilities.data ?? []) as ContractResponsibilityRow[]).map((row) => [
        row.contract_id,
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
      ])
    )

    // Top contracts by amount — a defined population ("los 1.000 mayores"),
    // not an arbitrary sample presented as a total.
    const stats = await supabase
      .from("contracts")
      .select("id, awarding_body, amount")
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(1000)
    throwDataError(stats.error, "contract stats")

    return {
      contracts: (data ?? []).map((row) => ({ ...row, responsible: responsibleByContract.get(row.id) ?? null })),
      total: count ?? 0,
      statsRows: stats.data ?? [],
    }
  },
  ["contract-page"],
  { revalidate: HOUR }
)

const VALID_ADMIN_LEVELS = new Set(["state", "autonomic", "municipal"])

export const getContractPageFiltered = unstable_cache(
  async (
    page: number,
    type: string,
    ministry: string | null,
    level: string | null,
    territory: string | null = null,
    year: number | null = null,
    province: string | null = null,
    municipio: string | null = null,
    flow: "by" | "to" = "by"
  ) => {
    const from = (page - 1) * PAGE_SIZE.contracts
    const to = from + PAGE_SIZE.contracts - 1
    let query = supabase
      .from("contracts")
      .select(
        "id, contract_folder_id, title, awarding_body, awarding_body_organization_id, amount, status, contract_type, region, date, source_url, contractor, contractor_nif, contractor_is_sme, contractor_is_ute, award_amount, award_amount_with_taxes, award_date, contract_number, received_tender_quantity",
        { count: "exact" }
      )
      .order("amount", { ascending: false, nullsFirst: false })

    if (type !== "all") query = query.eq("contract_type", type)
    if (ministry) query = query.eq("ministry_normalized", ministry)
    if (level && VALID_ADMIN_LEVELS.has(level)) query = query.eq("administration_level", level)
    // flow="by": territory of the awarding administration (who spends).
    // flow="to": territory of the contractor (where the money lands). No
    // contractor_ccaa_key column, so receptor filtering is province/municipio.
    if (flow === "to") {
      if (province) query = query.eq("contractor_province_key", province)
      if (municipio) query = query.eq("contractor_municipality_key", municipio)
    } else {
      if (territory) query = query.eq("ccaa_key", territory)
      if (province) query = query.eq("province_key", province)
      if (municipio) query = query.eq("municipality_key", municipio)
    }
    if (year) query = query.gte("date", `${year}-01-01`).lt("date", `${year + 1}-01-01`)

    const { data, count, error } = await query.range(from, to)
    throwDataError(error, "filtered contracts page")
    const contractIds = (data ?? []).map((row) => row.id)
    const responsibilities =
      contractIds.length > 0
        ? await supabase
            .from("v_contract_responsibility")
            .select("contract_id, person_name, politician_id, official_id, ministry, government, political_party, administration_level, territory_name, match_method")
            .in("contract_id", contractIds)
        : { data: [] }
    throwDataError("error" in responsibilities ? responsibilities.error : null, "contract responsibilities")

    const responsibleByContract = new Map(
      ((responsibilities.data ?? []) as ContractResponsibilityRow[]).map((row) => [
        row.contract_id,
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
      ])
    )

    return {
      contracts: (data ?? []).map((row) => ({ ...row, responsible: responsibleByContract.get(row.id) ?? null })),
      total: count ?? 0,
    }
  },
  ["contract-page-filtered"],
  { revalidate: HOUR }
)

export const getContractDetail = unstable_cache(
  async (id: string) => {
    const [contract, responsibility] = await Promise.all([
      supabase
        .from("contracts")
        .select(
          "id, contract_folder_id, title, awarding_body, awarding_body_normalized, awarding_body_organization_id, amount, currency, date, contractor, contractor_nif, contractor_organization_id, contractor_is_sme, contractor_is_ute, award_amount, award_amount_with_taxes, award_date, contract_number, received_tender_quantity, description, source_url, contract_type, cpv_code, region, ministry_normalized, administration_level"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("v_contract_responsibility")
        .select("person_name, politician_id, official_id, ministry, government, political_party, administration_level, territory_name")
        .eq("contract_id", id)
        .maybeSingle(),
    ])
    throwDataError(contract.error, "contract detail")
    throwDataError(responsibility.error, "contract responsibility")
    return { contract: contract.data, responsible: responsibility.data ?? null }
  },
  ["contract-detail"],
  { revalidate: HOUR }
)
