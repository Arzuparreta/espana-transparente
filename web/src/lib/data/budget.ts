import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, type BudgetSourceKind, type BudgetType } from "./shared"

export type { BudgetType }
export type { BudgetSourceKind }

export const BUDGET_YEAR_META: Record<
  number,
  { budgetType: BudgetType; label: string; note: string }
> = {
  2016: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2017: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2018: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2019: {
    budgetType: "proyecto",
    label: "No aprobado",
    note: "Los datos publicados corresponden al proyecto 2019P; no llegó a aprobarse y no entró en vigor.",
  },
  2021: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2022: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2023: { budgetType: "ley", label: "Aprobado", note: "PGE aprobado." },
  2024: {
    budgetType: "prorroga",
    label: "Prórroga vigente",
    note: "No hubo un nuevo presupuesto aprobado. Siguieron en vigor los créditos prorrogados del PGE 2023, publicados por SEPG.",
  },
  2025: {
    budgetType: "prorroga",
    label: "Prórroga vigente",
    note: "No hubo un nuevo presupuesto aprobado. Siguieron en vigor los créditos prorrogados del PGE 2023, publicados por SEPG.",
  },
  2026: {
    budgetType: "prorroga",
    label: "Prórroga vigente",
    note: "No hubo un nuevo presupuesto aprobado. Siguen en vigor los créditos prorrogados del PGE 2023, publicados por SEPG para 2026.",
  },
}

export const BUDGET_YEARS = Object.keys(BUDGET_YEAR_META)
  .map((year) => Number.parseInt(year, 10))
  .sort((a, b) => a - b)

export function getBudgetYearMeta(year: number) {
  return BUDGET_YEAR_META[year] ?? null
}

export function getBudgetSourceNote(row: {
  source_kind?: BudgetSourceKind | string | null
  source_year?: number | null
  in_force_year?: number | null
}) {
  if (row.source_kind === "carried_forward" && row.source_year) {
    return `Dato prorrogado desde PGE ${row.source_year}`
  }
  if (row.source_kind === "published_prorroga" && row.in_force_year) {
    return `Dato de prórroga · PGE en vigor ${row.in_force_year}`
  }
  return null
}

export const getBudgetSummary = unstable_cache(
  async (year: number) => {
    const { data } = await supabase
      .from("v_budget_summary")
      .select("year, budget_type, source_kind, source_year, in_force_year, section_code, section_name, ministry_normalized, program_count, total_credit_initial, total_credit_final")
      .eq("year", year)
      .order("total_credit_initial", { ascending: false, nullsFirst: false })
    return data ?? []
  },
  ["budget-summary"],
  { revalidate: HOUR }
)

export const getBudgetSection = unstable_cache(
  async (year: number, sectionCode: string) => {
    const { data } = await supabase
      .from("v_budget_by_program")
      .select("year, budget_type, source_kind, source_year, in_force_year, section_code, section_name, program_code, program_name, ministry_normalized, total_credit_initial, total_credit_final, by_chapter")
      .eq("year", year)
      .eq("section_code", sectionCode)
      .order("total_credit_initial", { ascending: false, nullsFirst: false })
    return data ?? []
  },
  ["budget-section"],
  { revalidate: HOUR }
)

export const getBudgetProgram = unstable_cache(
  async (sectionCode: string, programCode: string) => {
    const { data } = await supabase
      .from("v_budget_by_program")
      .select("year, budget_type, source_kind, source_year, in_force_year, section_code, section_name, program_code, program_name, ministry_normalized, total_credit_initial, total_credit_final, by_chapter")
      .eq("section_code", sectionCode)
      .eq("program_code", programCode)
      .order("year", { ascending: false })
    return data ?? []
  },
  ["budget-program"],
  { revalidate: HOUR }
)

export const getBudgetMinister = unstable_cache(
  async (year: number, sectionCode: string) => {
    const { data } = await supabase
      .from("v_budget_responsibility")
      .select("budget_type, minister_name, responsibility_position_id")
      .eq("year", year)
      .eq("section_code", sectionCode)
      .not("minister_name", "is", null)
      .limit(1)
      .maybeSingle()
    return data ?? null
  },
  ["budget-minister"],
  { revalidate: HOUR }
)

export type TopBudgetSectionAncla = {
  year: number
  budget_type: string | null
  source_kind: string | null
  source_year: number | null
  in_force_year: number | null
  section_code: string
  section_name: string
  ministry_normalized: string | null
  total_credit_initial: number
  minister_name: string | null
  statusLabel: string | null
}

export const getTopBudgetSectionAnchor = unstable_cache(
  async (): Promise<TopBudgetSectionAncla | null> => {
    for (let i = BUDGET_YEARS.length - 1; i >= 0; i--) {
      const year = BUDGET_YEARS[i]
      const { data } = await supabase
      .from("v_budget_summary")
        .select("year, budget_type, source_kind, source_year, in_force_year, section_code, section_name, ministry_normalized, total_credit_initial")
        .eq("year", year)
        .gt("total_credit_initial", 0)
        .order("total_credit_initial", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

      if (!data?.total_credit_initial) continue

      const minister = await getBudgetMinister(year, data.section_code as string)
      const meta = getBudgetYearMeta(year)

      return {
        year,
        budget_type: (data.budget_type as string | null) ?? null,
        source_kind: (data.source_kind as string | null) ?? null,
        source_year: (data.source_year as number | null) ?? null,
        in_force_year: (data.in_force_year as number | null) ?? null,
        section_code: data.section_code as string,
        section_name: data.section_name as string,
        ministry_normalized: (data.ministry_normalized as string | null) ?? null,
        total_credit_initial: data.total_credit_initial as number,
        minister_name: (minister?.minister_name as string | null) ?? null,
        statusLabel: meta?.label ?? null,
      }
    }
    return null
  },
  ["top-budget-section-anchor"],
  { revalidate: HOUR }
)
