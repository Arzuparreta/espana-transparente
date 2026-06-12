import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { BudgetStatusBanner } from "@/components/presupuestos/BudgetStatusBanner"
import { PresupuestosClient } from "@/components/presupuestos/PresupuestosClient"
import { BUDGET_YEARS, getBudgetYearMeta, getBudgetSummary, getEtlLastFinished } from "@/lib/data"
import { formatEuroCompact } from "@/lib/format"

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

function pensionProgramCode(year: number) {
  return year >= 2023 ? "211A" : "211M"
}

function clasesPasivasProgramCode(year: number) {
  return year >= 2023 ? "211B" : "211N"
}

export default async function PresupuestosPage({ searchParams }: PageProps) {
  const latestYear = BUDGET_YEARS[BUDGET_YEARS.length - 1]
  const requestedYear = Number.parseInt(searchParams?.year ?? String(latestYear), 10)
  const year = BUDGET_YEARS.includes(requestedYear) ? requestedYear : latestYear
  const meta = getBudgetYearMeta(year)

  const [rows, lastChecked] = await Promise.all([
    getBudgetSummary(year),
    getEtlLastFinished(["presupuestos"]),
  ])

  const totalInitial = rows.reduce((sum, r) => sum + (r.total_credit_initial ?? 0), 0)
  const sectionCount = rows.length
  const programCount = rows.reduce((sum, r) => sum + (r.program_count ?? 0), 0)
  const prorrogaCount = rows.filter(
    (r) => r.source_kind === "carried_forward" || r.source_kind === "published_prorroga"
  ).length

  const socialSecurity = rows.find((row) => row.section_code === "60")
  const clasesPasivas = rows.find((row) => row.section_code === "07")
  const budgetAccess = [
    {
      href: `/presupuestos/60?year=${year}`,
      label: "Seguridad Social",
      detail: "Sección 60 · pensiones contributivas y prestaciones",
      amount: socialSecurity?.total_credit_initial ?? null,
    },
    {
      href: `/presupuestos/60/${pensionProgramCode(year)}`,
      label: "Pensiones contributivas",
      detail: `Programa ${pensionProgramCode(year)} · Seguridad Social`,
      amount: null,
    },
    {
      href: `/presupuestos/07?year=${year}`,
      label: "Clases Pasivas",
      detail: "Sección 07 · pensiones de funcionarios y régimen especial",
      amount: clasesPasivas?.total_credit_initial ?? null,
    },
    {
      href: `/presupuestos/07/${clasesPasivasProgramCode(year)}`,
      label: "Pensiones de Clases Pasivas",
      detail: `Programa ${clasesPasivasProgramCode(year)} · Clases Pasivas`,
      amount: null,
    },
  ]

  return (
    <div className="ui-page">
      <PageHeader
        title="Presupuestos"
        description="El plan anual del Estado: cuánto piensa gastar y en qué áreas (sanidad, defensa, educación, pensiones). Cuando no hay nuevo presupuesto aprobado, se muestran los créditos prorrogados."
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
            { label: `Crédito inicial ${year}`, value: formatEuroCompact(totalInitial) },
            { label: "Secciones", value: sectionCount.toLocaleString("es-ES") },
            { label: "Programas", value: programCount.toLocaleString("es-ES") },
            ...(prorrogaCount > 0
              ? [
                  {
                    label: "En prórroga",
                    value: `${prorrogaCount} ${prorrogaCount === 1 ? "sección" : "secciones"}`,
                    hint: "Sin nuevo presupuesto aprobado: créditos del año anterior prorrogados automáticamente.",
                    valueClassName: "text-amber-600 dark:text-amber-400",
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      <SourceFootnote
        sourceLabel="SEPG · Ministerio de Hacienda"
        lastChecked={lastChecked}
        coverageLabel={`${BUDGET_YEARS[0]}–${BUDGET_YEARS[BUDGET_YEARS.length - 1]} (sin 2020)${
          meta?.label ? ` · ${meta.label} ${year}` : ""
        }`}
      />

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Accesos directos
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {budgetAccess.map((item) => (
            <ResponsiveLink
              key={item.href}
              href={item.href}
              className="min-w-0 rounded-[2px] border border-border/70 bg-card px-4 py-3 text-sm transition-colors hover:border-foreground/40"
            >
              <span className="block truncate font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                {item.detail}
                {item.amount != null ? ` · ${formatEuroCompact(item.amount)}` : ""}
              </span>
            </ResponsiveLink>
          ))}
        </div>
      </section>

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
