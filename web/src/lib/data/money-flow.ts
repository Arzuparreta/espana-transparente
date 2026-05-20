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
}

export const getMoneyFlowYear = unstable_cache(
  async (year: number): Promise<MoneyFlowSection[]> => {
    const { data, error } = await supabase
      .from("v_program_money_flow")
      .select(
        "year, budget_type, section_code, section_name, ministry_normalized, minister_person_id, minister_name, program_code, program_name, total_credit_initial, contract_count, contract_total, subsidy_count, subsidy_total, latest_record_date"
      )
      .eq("year", year)
      .order("section_code", { ascending: true })
      .order("total_credit_initial", { ascending: false, nullsFirst: false })

    if (error || !data) return []
    const rows = data as MoneyFlowRow[]

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
