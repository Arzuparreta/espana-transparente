"use client"

import { EmptyState } from "@/components/domain/EmptyState"
import { LinkTabs } from "@/components/domain/LinkTabs"
import { Card, CardContent } from "@/components/ui/card"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { BUDGET_YEARS, getBudgetYearMeta, type BudgetType } from "@/lib/data"

interface BudgetSectionRow {
  budget_type: BudgetType
  section_code: string
  section_name: string | null
  ministry_normalized: string | null
  program_count: number
  total_credit_initial: number | null
  total_credit_final: number | null
}

interface PresupuestosClientProps {
  year: number
  rows: BudgetSectionRow[]
}

function formatAmount(eur: number | null): string {
  if (eur == null) return "—"
  if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(0)}M €`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)}K €`
  return `${Math.round(eur)} €`
}

function budgetHref(year: number) {
  return year === BUDGET_YEARS[BUDGET_YEARS.length - 1]
    ? "/presupuestos"
    : `/presupuestos?year=${year}`
}

function SectionCard({ row, year }: { row: BudgetSectionRow; year: number }) {
  const fraction =
    row.total_credit_final != null && row.total_credit_initial
      ? row.total_credit_final / row.total_credit_initial
      : null

  return (
    <ResponsiveLink href={`/presupuestos/${encodeURIComponent(row.section_code)}?year=${year}`}>
      <Card className="transition-colors hover:bg-card">
        <CardContent className="flex items-start gap-4 px-4 py-4 sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug text-balance">
              {row.section_name ?? row.section_code}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {row.program_count} {row.program_count === 1 ? "programa" : "programas"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-semibold tabular-nums">
              {formatAmount(row.total_credit_initial)}
            </div>
            {fraction != null && Math.abs(fraction - 1) > 0.001 ? (
              <div className="text-[11px] text-muted-foreground">
                definitivo: {formatAmount(row.total_credit_final)}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </ResponsiveLink>
  )
}

export function PresupuestosClient({ year, rows }: PresupuestosClientProps) {
  const meta = getBudgetYearMeta(year)

  return (
    <div className="space-y-6">
      <LinkTabs
        ariaLabel="Años presupuestarios"
        scroll={false}
        tabs={BUDGET_YEARS.map((y) => ({
          href: budgetHref(y),
          label: String(y),
          active: y === year,
          badge: getBudgetYearMeta(y)?.label,
        }))}
      />

      {/* Section list */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          {rows.length} secciones · ordenadas por crédito inicial
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={`Sin secciones para ${year}`}
            description={
              meta?.budgetType === "prorroga" || meta?.budgetType === "proyecto"
                ? meta.note
                : <>Ejecuta el ETL: <code>PYTHONPATH=src python -m src.presupuestos.presupuestos --year {year}</code></>
            }
          />
        ) : (
          rows.map((row) => <SectionCard key={row.section_code} row={row} year={year} />)
        )}
      </div>
    </div>
  )
}
