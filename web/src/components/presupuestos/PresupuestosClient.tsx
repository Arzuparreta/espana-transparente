"use client"

import { Card, CardContent } from "@/components/ui/card"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { BUDGET_YEARS } from "@/lib/data"

interface BudgetSectionRow {
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
  if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(1)}B €`
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(0)}M €`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)}K €`
  return `${Math.round(eur)} €`
}

function budgetHref(year: number) {
  return year === new Date().getFullYear()
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
      <Card className="bg-card/85 transition-colors hover:bg-card">
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
  return (
    <div className="space-y-6">
      {/* Year tabs */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="inline-flex min-w-full gap-2 border-b border-border/70 pb-1">
          {BUDGET_YEARS.map((y) => {
            const isActive = y === year
            return (
              <ResponsiveLink
                key={y}
                href={budgetHref(y)}
                className={
                  isActive
                    ? "shrink-0 rounded-full bg-foreground px-3 py-2 text-sm font-medium text-background"
                    : "shrink-0 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              >
                {y}
              </ResponsiveLink>
            )
          })}
        </div>
      </div>

      {/* Section list */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          {rows.length} secciones · ordenadas por crédito inicial
        </div>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Sin datos para {year}. Ejecuta el ETL:{" "}
              <code>PYTHONPATH=src python -m src.presupuestos.presupuestos --year {year}</code>
            </CardContent>
          </Card>
        ) : (
          rows.map((row) => <SectionCard key={row.section_code} row={row} year={year} />)
        )}
      </div>
    </div>
  )
}
