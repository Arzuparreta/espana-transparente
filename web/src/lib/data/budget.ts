import { publishedBudgetTotal } from "@/lib/budget-context"
import { supabase } from "@/lib/supabase/public"
import { unstable_cache, HOUR, throwDataError, type BudgetSourceKind, type BudgetType } from "./shared"

export type { BudgetType }
export type { BudgetSourceKind }

import { BUDGET_YEARS, getBudgetYearMeta } from "@/lib/budget-metadata"
export { BUDGET_YEARS, BUDGET_YEAR_META, getBudgetYearMeta, getBudgetSourceNote } from "@/lib/budget-metadata"

export const getBudgetSummary = unstable_cache(
  async (year: number) => {
    const { data, error } = await supabase
      .from("v_budget_summary")
      .select("year, budget_type, source_kind, source_year, in_force_year, section_code, section_name, ministry_normalized, program_count, total_credit_initial, total_credit_final")
      .eq("year", year)
      .order("total_credit_initial", { ascending: false, nullsFirst: false })
    throwDataError(error, "budget summary")
    return data ?? []
  },
  ["budget-summary-editions-v2"],
  { revalidate: HOUR }
)

export const getBudgetSection = unstable_cache(
  async (year: number, sectionCode: string) => {
    const { data, error } = await supabase
      .from("v_budget_by_program")
      .select("year, budget_type, source_kind, source_year, in_force_year, section_code, section_name, program_code, program_name, ministry_normalized, total_credit_initial, total_credit_final, by_chapter")
      .eq("year", year)
      .eq("section_code", sectionCode)
      .order("total_credit_initial", { ascending: false, nullsFirst: false })
    throwDataError(error, "budget section")
    return data ?? []
  },
  ["budget-section-editions-v2"],
  { revalidate: HOUR }
)

export const getBudgetProgram = unstable_cache(
  async (sectionCode: string, programCode: string) => {
    const { data, error } = await supabase
      .from("v_budget_by_program")
      .select("year, budget_type, source_kind, source_year, in_force_year, section_code, section_name, program_code, program_name, ministry_normalized, total_credit_initial, total_credit_final, by_chapter")
      .eq("section_code", sectionCode)
      .eq("program_code", programCode)
      .order("year", { ascending: false })
    throwDataError(error, "budget program")
    return data ?? []
  },
  ["budget-program-editions-v2"],
  { revalidate: HOUR }
)

export const getBudgetMinister = unstable_cache(
  async (year: number, sectionCode: string) => {
    const { data, error } = await supabase
      .from("v_budget_responsibility")
      .select("budget_type, minister_name, responsibility_position_id")
      .eq("year", year)
      .eq("section_code", sectionCode)
      .not("minister_name", "is", null)
      .limit(1)
      .maybeSingle()
    throwDataError(error, "budget minister")
    return data ?? null
  },
  ["budget-minister"],
  { revalidate: HOUR }
)

export type BudgetAnchor = {
  year: number
  budget_type: string | null
  source_kind: string | null
  source_year: number | null
  in_force_year: number | null
  total_credit_initial: number
  section_count: number
  statusLabel: string | null
}

export const getBudgetAnchor = unstable_cache(
  async (): Promise<BudgetAnchor | null> => {
    for (let i = BUDGET_YEARS.length - 1; i >= 0; i--) {
      const year = BUDGET_YEARS[i]
      const rows = await getBudgetSummary(year)
      if (rows.length === 0) continue

      const total = publishedBudgetTotal(rows)
      if (total == null || total <= 0) continue

      const first = rows[0]
      const meta = getBudgetYearMeta(year)

      return {
        year,
        budget_type: (first.budget_type as string | null) ?? null,
        source_kind: (first.source_kind as string | null) ?? null,
        source_year: (first.source_year as number | null) ?? null,
        in_force_year: (first.in_force_year as number | null) ?? null,
        total_credit_initial: total,
        section_count: rows.length,
        statusLabel: meta?.label ?? null,
      }
    }
    return null
  },
  ["budget-anchor-home"],
  { revalidate: HOUR }
)

export const getBudgetProgramEvidence = unstable_cache(
  async (sectionCode: string, programCode: string) => {
    const { data, error } = await supabase.from("budget_lines")
      .select("year, source_kind, source_url")
      .eq("section_code", sectionCode).eq("program_code", programCode)
    throwDataError(error, "budget program sources")
    return data ?? []
  }, ["budget-program-evidence"], { revalidate: HOUR }
)
