import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { PresupuestosClient } from "@/components/presupuestos/PresupuestosClient"
import { BUDGET_YEARS, getBudgetSummary } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  searchParams?: {
    year?: string
  }
}

export default async function PresupuestosPage({ searchParams }: PageProps) {
  const currentYear = new Date().getFullYear()
  const requestedYear = Number.parseInt(searchParams?.year ?? String(currentYear), 10)
  const year = BUDGET_YEARS.includes(requestedYear) ? requestedYear : currentYear

  const rows = await getBudgetSummary(year)

  const totalInitial = rows.reduce((sum, r) => sum + (r.total_credit_initial ?? 0), 0)
  const sectionCount = rows.length
  const programCount = rows.reduce((sum, r) => sum + (r.program_count ?? 0), 0)

  function formatAmount(eur: number): string {
    if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(1)}B €`
    if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(0)}M €`
    return `${Math.round(eur)} €`
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Presupuestos"
        description="Créditos aprobados de los Presupuestos Generales del Estado, por sección ministerial y programa."
      />

      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{formatAmount(totalInitial)}</div>
            <div className="text-xs text-muted-foreground">Crédito inicial {year}</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{sectionCount}</div>
            <div className="text-xs text-muted-foreground">Secciones</div>
          </div>
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{programCount}</div>
            <div className="text-xs text-muted-foreground">Programas</div>
          </div>
        </div>
      ) : null}

      <PresupuestosClient year={year} rows={rows} />

      <InfoPanel title="Fuente">
        Fuente: Secretaría de Estado de Presupuestos y Gastos (SEPG) · Ministerio de Hacienda.
        Datos de dotación aprobada (crédito inicial y crédito definitivo tras modificaciones).
        Cobertura 2016–{currentYear}.
      </InfoPanel>
    </div>
  )
}
