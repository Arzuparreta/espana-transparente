import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { BudgetStatusBanner } from "@/components/presupuestos/BudgetStatusBanner"
import { PresupuestosClient } from "@/components/presupuestos/PresupuestosClient"
import { BUDGET_YEARS, getBudgetYearMeta, getBudgetSummary } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Presupuestos del Estado",
  description: "Presupuestos Generales del Estado por sección, programa y capítulo desde 2016.",
}

interface PageProps {
  searchParams?: {
    year?: string
  }
}

export default async function PresupuestosPage({ searchParams }: PageProps) {
  const latestYear = BUDGET_YEARS[BUDGET_YEARS.length - 1]
  const requestedYear = Number.parseInt(searchParams?.year ?? String(latestYear), 10)
  const year = BUDGET_YEARS.includes(requestedYear) ? requestedYear : latestYear
  const meta = getBudgetYearMeta(year)

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
        description="El plan anual del Estado: cuánto piensa gastar y en qué áreas (sanidad, defensa, educación, pensiones). Aprobado por el Congreso cada año."
      />

      {meta ? (
        <BudgetStatusBanner
          year={year}
          label={meta.label}
          note={meta.note}
          budgetType={meta.budgetType}
        />
      ) : null}

      {rows.length > 0 ? (
        <StatGrid
          items={[
            { label: `Crédito inicial ${year}`, value: formatAmount(totalInitial) },
            { label: "Secciones", value: sectionCount.toLocaleString("es-ES") },
            { label: "Programas", value: programCount.toLocaleString("es-ES") },
          ]}
        />
      ) : null}

      <PresupuestosClient year={year} rows={rows} />

      <InfoPanel title="Fuente">
        Secretaría de Estado de Presupuestos y Gastos (SEPG) · Ministerio de Hacienda.
        Datos de dotación presupuestaria por sección y programa.
        Cobertura 2016–{latestYear} (sin 2020; España prorrogó el PGE 2018 ese año).
        {meta ? ` Estado ${year}: ${meta.note}` : ""}
      </InfoPanel>
    </div>
  )
}
