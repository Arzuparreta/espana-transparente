import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"

export type MoneyFlowRow = {
  year: number
  budget_type: string | null
  section_code: string
  section_name: string | null
  ministry_normalized: string | null
  minister_person_id: string | null
  minister_name: string | null
  program_code: string
  program_name: string | null
  total_credit_initial: number | null
  contract_count: number
  contract_total: number
  subsidy_count: number
  subsidy_total: number
  latest_record_date: string | null
}

export type TopBeneficiary = {
  name: string
  source_type: "contract" | "subsidy"
  record_count: number
  total_amount: number
  organization_id: string | null
  eu_fund_total: number | null
  eu_fund_project_count: number | null
}

export type EuFundSectionSummary = {
  eu_fund_count: number
  eu_fund_total: number
  eu_fund_total_with_cofinancing: number
  orgs_with_eu_funds: number
}

export type MoneyFlowSection = {
  section_code: string
  section_name: string
  ministry_normalized: string | null
  minister_person_id: string | null
  minister_name: string | null
  total_credit_initial: number
  contract_count: number
  contract_total: number
  subsidy_count: number
  subsidy_total: number
  latest_record_date: string | null
  programs: {
    program_code: string
    program_name: string | null
    total_credit_initial: number | null
  }[]
  top_contractors: TopBeneficiary[]
  top_subsidy_beneficiaries: TopBeneficiary[]
  eu_fund_summary: EuFundSectionSummary | null
}

// Strip leading NIF/CIF prefix from Spanish beneficiary names (e.g. "Q2818002D NOMBRE" → "NOMBRE")
function stripNif(name: string): string {
  return name.replace(/^[A-Z0-9]{9} /, "")
}

export const getMoneyFlowYear = unstable_cache(
  async (year: number): Promise<MoneyFlowSection[]> => {
    const [{ data, error }, { data: benData }, { data: euData }] = await Promise.all([
      supabase
        .from("v_program_money_flow")
        .select(
          "year, budget_type, section_code, section_name, ministry_normalized, minister_person_id, minister_name, program_code, program_name, total_credit_initial, contract_count, contract_total, subsidy_count, subsidy_total, latest_record_date"
        )
        .eq("year", year)
        .order("section_code", { ascending: true })
        .order("total_credit_initial", { ascending: false, nullsFirst: false }),
      supabase
        .from("v_ministry_top_beneficiaries")
        .select("ministry_normalized, name, source_type, record_count, total_amount, organization_id, eu_fund_total, eu_fund_project_count"),
      supabase
        .from("v_section_eu_fund_summary")
        .select("ministry_normalized, eu_fund_count, eu_fund_total, eu_fund_total_with_cofinancing, orgs_with_eu_funds"),
    ])

    if (error || !data) return []
    const rows = data as MoneyFlowRow[]

    // Index beneficiaries by ministry
    type BenRow = { ministry_normalized: string; name: string; source_type: string; record_count: number; total_amount: number; organization_id: string | null; eu_fund_total: number | null; eu_fund_project_count: number | null }
    const contractorsByMinistry = new Map<string, TopBeneficiary[]>()
    const subsidyBenByMinistry = new Map<string, TopBeneficiary[]>()
    for (const b of (benData ?? []) as BenRow[]) {
      const entry: TopBeneficiary = {
        name: b.source_type === "subsidy" ? stripNif(b.name) : b.name,
        source_type: b.source_type as "contract" | "subsidy",
        record_count: Number(b.record_count),
        total_amount: Number(b.total_amount),
        organization_id: b.organization_id ?? null,
        eu_fund_total: b.eu_fund_total != null ? Number(b.eu_fund_total) : null,
        eu_fund_project_count: b.eu_fund_project_count != null ? Number(b.eu_fund_project_count) : null,
      }
      const map = b.source_type === "contract" ? contractorsByMinistry : subsidyBenByMinistry
      const key = b.ministry_normalized
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(entry)
    }

    // Index EU fund summary by ministry
    type EuRow = { ministry_normalized: string; eu_fund_count: number; eu_fund_total: number; eu_fund_total_with_cofinancing: number; orgs_with_eu_funds: number }
    const euFundByMinistry = new Map<string, EuFundSectionSummary>()
    for (const e of (euData ?? []) as EuRow[]) {
      euFundByMinistry.set(e.ministry_normalized, {
        eu_fund_count: Number(e.eu_fund_count),
        eu_fund_total: Number(e.eu_fund_total),
        eu_fund_total_with_cofinancing: Number(e.eu_fund_total_with_cofinancing),
        orgs_with_eu_funds: Number(e.orgs_with_eu_funds),
      })
    }

    const sections = new Map<string, MoneyFlowSection>()
    for (const row of rows) {
      const existing = sections.get(row.section_code)
      if (!existing) {
        sections.set(row.section_code, {
          section_code: row.section_code,
          section_name: row.section_name ?? row.section_code,
          ministry_normalized: row.ministry_normalized,
          minister_person_id: row.minister_person_id,
          minister_name: row.minister_name,
          total_credit_initial: Number(row.total_credit_initial ?? 0),
          contract_count: Number(row.contract_count ?? 0),
          contract_total: Number(row.contract_total ?? 0),
          subsidy_count: Number(row.subsidy_count ?? 0),
          subsidy_total: Number(row.subsidy_total ?? 0),
          latest_record_date: row.latest_record_date ?? null,
          programs: [
            {
              program_code: row.program_code,
              program_name: row.program_name,
              total_credit_initial: row.total_credit_initial != null ? Number(row.total_credit_initial) : null,
            },
          ],
          top_contractors: row.ministry_normalized ? (contractorsByMinistry.get(row.ministry_normalized) ?? []) : [],
          top_subsidy_beneficiaries: row.ministry_normalized ? (subsidyBenByMinistry.get(row.ministry_normalized) ?? []) : [],
          eu_fund_summary: row.ministry_normalized ? (euFundByMinistry.get(row.ministry_normalized) ?? null) : null,
        })
      } else {
        existing.total_credit_initial += Number(row.total_credit_initial ?? 0)
        existing.programs.push({
          program_code: row.program_code,
          program_name: row.program_name,
          total_credit_initial: row.total_credit_initial != null ? Number(row.total_credit_initial) : null,
        })
      }
    }

    return Array.from(sections.values()).sort(
      (a, b) => b.total_credit_initial - a.total_credit_initial
    )
  },
  ["money-flow-year"],
  { revalidate: HOUR }
)
