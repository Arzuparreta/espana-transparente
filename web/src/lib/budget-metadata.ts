import type { BudgetSourceKind } from "./data/shared"
import type { BudgetType } from "./data/shared"

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
    label: "Prórroga publicada",
    note: "Edición de la prórroga publicada por SEPG para este ejercicio, con base en el PGE aprobado de 2023. Seguridad Social conserva una referencia de 2023 separada.",
  },
  2025: {
    budgetType: "prorroga",
    label: "Prórroga publicada",
    note: "Edición de la prórroga publicada por SEPG para este ejercicio, con base en el PGE aprobado de 2023. Seguridad Social conserva una referencia de 2023 separada.",
  },
  2026: {
    budgetType: "prorroga",
    label: "Prórroga publicada",
    note: "Edición de la prórroga publicada por SEPG para 2026, con base en el PGE aprobado de 2023. Seguridad Social conserva una referencia de 2023 separada.",
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
    return `Referencia de PGE ${row.source_year}; crédito actualizado no acreditado`
  }
  if (row.source_kind === "published_prorroga" && row.in_force_year) {
    return `Prórroga publicada para ${row.source_year ?? "este ejercicio"} · base aprobada ${row.in_force_year}`
  }
  return null
}
