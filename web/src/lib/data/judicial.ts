import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE } from "./shared"

export type JudicialStatus =
  | "procesamiento_o_juicio_oral"
  | "condena_no_firme"
  | "condena_firme"
  | "absuelto"
  | "sobreseido"
  | "desconocido"

export const JUDICIAL_STATUS_LABEL: Record<JudicialStatus, string> = {
  procesamiento_o_juicio_oral: "Procesamiento o juicio oral",
  condena_no_firme: "Condena no firme",
  condena_firme: "Condena firme",
  absuelto: "Absuelto",
  sobreseido: "Sobreseído",
  desconocido: "Estado no especificado",
}

export const getJudicialCasesPage = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * PAGE_SIZE.judicialCases
    const to = from + PAGE_SIZE.judicialCases - 1
    const { data, count } = await supabase
      .from("v_corruption_cases_public")
      .select(
        "id, title, source_type, source_name, court_body, territory, offence_category, procedural_status, source_url, source_published_at, last_verified_at, reviewed_actor_count, reviewed_link_count",
        { count: "exact" }
      )
      .order("source_published_at", { ascending: false, nullsFirst: false })
      .range(from, to)

    return { cases: data ?? [], total: count ?? 0 }
  },
  ["judicial-cases-page"],
  { revalidate: HOUR }
)

export const getJudicialCaseDetail = unstable_cache(
  async (id: string) => {
    const [caseResult, actorsResult, linksResult] = await Promise.all([
      supabase
        .from("v_corruption_cases_public")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("v_corruption_case_actors_public")
        .select("id, actor_type, actor_label, role, politician_id, organization_id, party_id, evidence_url, reviewed_at")
        .eq("case_id", id)
        .order("actor_label"),
      supabase
        .from("v_corruption_contract_links_public")
        .select("id, actor_label, organization_id, contract_id, subsidy_id, link_reason, evidence_url, reviewed_at, contract_title, contract_amount, contract_contractor")
        .eq("case_id", id)
        .order("reviewed_at", { ascending: false, nullsFirst: false }),
    ])

    return {
      judicialCase: caseResult.data,
      actors: actorsResult.data ?? [],
      links: linksResult.data ?? [],
    }
  },
  ["judicial-case-detail"],
  { revalidate: HOUR }
)

export const getJudicialLinksForOrganizations = unstable_cache(
  async (organizationIds: string[]) => {
    if (organizationIds.length === 0) return []
    const uniqueIds = Array.from(new Set(organizationIds))
    const { data } = await supabase
      .from("v_corruption_contract_links_public")
      .select("id, case_id, case_title, procedural_status, offence_category, case_source_url, last_verified_at, actor_label, organization_id, contract_id, subsidy_id, link_reason, evidence_url, contract_title, contract_amount, contract_contractor")
      .in("organization_id", uniqueIds)
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .limit(10)
    return data ?? []
  },
  ["judicial-links-for-organizations"],
  { revalidate: HOUR }
)

export const getJudicialLinksForContract = unstable_cache(
  async (contractId: string, organizationIds: string[]) => {
    const direct = await supabase
      .from("v_corruption_contract_links_public")
      .select("id, case_id, case_title, procedural_status, offence_category, case_source_url, last_verified_at, actor_label, organization_id, contract_id, subsidy_id, link_reason, evidence_url, contract_title, contract_amount, contract_contractor")
      .eq("contract_id", contractId)
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .limit(10)

    const orgLinks = organizationIds.length > 0
      ? await getJudicialLinksForOrganizations(organizationIds)
      : []

    const byId = new Map<string, (typeof orgLinks)[number]>()
    for (const row of [...(direct.data ?? []), ...orgLinks]) byId.set(row.id, row)
    return Array.from(byId.values())
  },
  ["judicial-links-for-contract"],
  { revalidate: HOUR }
)
