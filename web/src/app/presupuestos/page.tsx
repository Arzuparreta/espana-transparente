import { budgetEditionUrl, budgetYearSelection, publishedBudgetTotal } from "@/lib/budget-context"
import { EmptyState } from "@/components/domain/EmptyState"
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
  searchParams?: Promise<{
    year?: string | string[]
  }>
}

function pensionProgramCode(year: number) {
  return year >= 2023 ? "211A" : "211M"
}

function clasesPasivasProgramCode(year: number) {
  return year >= 2023 ? "211B" : "211N"
}

export default async function PresupuestosPage({ searchParams }: PageProps) {
  const latestYear = BUDGET_YEARS[BUDGET_YEARS.length - 1]
  const year = budgetYearSelection((await searchParams)?.year, BUDGET_YEARS)
  if (year == null) return <div className="ui-page"><PageHeader title="Presupuestos" description="¿Qué créditos se publicaron para este ejercicio?" /><EmptyState title="Ejercicio no disponible" description="Selecciona un único año con datos. No se sustituye por otro ejercicio." /><ResponsiveLink href="/presupuestos" className="underline">Ver ejercicios disponibles</ResponsiveLink></div>
  const meta = getBudgetYearMeta(year)

  const [rows, lastChecked] = await Promise.all([
    getBudgetSummary(year),
    getEtlLastFinished(["presupuestos"]),
  ])

  const totalInitial = publishedBudgetTotal(rows)
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
      detail: year >= 2024 ? "Sección 60 · referencia de 2023, no crédito actualizado" : "Sección 60 · pensiones contributivas y prestaciones",
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
        description="¿Qué créditos se publicaron y para qué programas? Dotaciones presupuestarias, con referencias históricas separadas. No son gasto realizado ni pago; las transferencias entre entidades impiden leer la suma como gasto final consolidado."
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
            { label: `Créditos publicados ${year}`, value: formatEuroCompact(totalInitial) },
            { label: "Secciones", value: sectionCount.toLocaleString("es-ES") },
            { label: "Programas", value: programCount.toLocaleString("es-ES") },
            ...(prorrogaCount > 0
              ? [
                  {
                    label: "En prórroga",
                    value: `${prorrogaCount} ${prorrogaCount === 1 ? "sección" : "secciones"}`,
                    hint: "Edición oficial de prórroga y referencias históricas, identificadas por separado.",
                    valueClassName: "text-amber-600 dark:text-amber-400",
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      <SourceFootnote
        sourceLabel={year >= 2024 ? "SEPG · Ministerio de Hacienda" : "SEPG · extracción de Civio scraper-pge"}
        lastChecked={lastChecked}
        coverageLabel={`${BUDGET_YEARS[0]}–${BUDGET_YEARS[BUDGET_YEARS.length - 1]} (sin 2020)${
          meta?.label ? ` · ${meta.label} ${year}` : ""
        }`}
      />

      <p className="text-sm leading-6">El total excluye los importes marcados como referencia de 2023. En la prórroga cubre el sector administrativo estatal con presupuesto limitativo publicado en la serie roja; no equivale a todas las administraciones. <a href={budgetEditionUrl(year)} target="_blank" rel="noopener noreferrer" className="underline">Edición oficial del ejercicio {year}</a>.</p>
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

      <p className="my-3 text-sm"><ResponsiveLink href="/ejecucion-presupuestaria?period=2025-12" className="underline underline-offset-4">
          Ver ejecución del presupuesto estatal a diciembre de 2025 →
        </ResponsiveLink>{" "}Piloto IGAE con créditos definitivos, obligaciones y pagos del presupuesto corriente. Tiene su propio ámbito y corte; no aplica el año ni los programas seleccionados aquí.</p>
      <InfoPanel title="Fuente">
        Secretaría de Estado de Presupuestos y Gastos (SEPG) · Ministerio de Hacienda.
        Datos de dotación presupuestaria por sección y programa. Hasta 2023, extracción de Civio scraper-pge; desde 2024, CSV de las ediciones oficiales de prórroga.
        Cobertura 2016–{latestYear} (sin 2020; España prorrogó el PGE 2018 ese año).
        {meta ? ` Estado ${year}: ${meta.note}` : ""}
      </InfoPanel>
    </div>
  )
}
