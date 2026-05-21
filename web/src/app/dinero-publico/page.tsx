import { EmptyState } from "@/components/domain/EmptyState"
import { MoneyFlowExplorer } from "@/components/domain/MoneyFlowExplorer"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  BUDGET_YEARS,
  getBudgetYearMeta,
  getEtlLastFinished,
  getEuFundsSummary,
  getMoneyFlowYear,
} from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Trazabilidad del gasto",
  description:
    "Cómo se conectan los Presupuestos Generales del Estado con los contratos y subvenciones publicados por ministerio responsable.",
}

interface PageProps {
  searchParams?: {
    year?: string
    section?: string
    program?: string
  }
}

function formatAmount(value: number | null | undefined): string {
  if (value == null || value === 0) return "—"
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")} mil M €`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M €`
  return `${Math.round(value).toLocaleString("es-ES")} €`
}

export default async function DineroPublicoPage({ searchParams }: PageProps) {
  const latestYear = BUDGET_YEARS[BUDGET_YEARS.length - 1]
  const requestedYear = Number.parseInt(searchParams?.year ?? String(latestYear), 10)
  const year = BUDGET_YEARS.includes(requestedYear) ? requestedYear : latestYear
  const meta = getBudgetYearMeta(year)

  const [sections, lastChecked, euSummary] = await Promise.all([
    getMoneyFlowYear(year),
    getEtlLastFinished(["presupuestos", "contracts_daily", "subsidies_daily", "kohesio"]),
    getEuFundsSummary(),
  ])

  const totalCredit = sections.reduce((sum, s) => sum + s.total_credit_initial, 0)
  const totalPrograms = sections.reduce((sum, s) => sum + s.programs.length, 0)
  const totalContractCount = sections.reduce((sum, s) => sum + s.contract_count, 0)
  const totalSubsidyCount = sections.reduce((sum, s) => sum + s.subsidy_count, 0)
  const resolvedMinisters = sections.filter((s) => s.minister_name).length
  const sectionsWithEuFunds = sections.filter((s) => s.eu_fund_summary && s.eu_fund_summary.eu_fund_count > 0).length
  const cascadeEuFundTotal = sections.reduce((sum, s) => sum + (s.eu_fund_summary?.eu_fund_total ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Trazabilidad del gasto"
        description="Recorrido del dinero público desde el Presupuesto General del Estado hasta los contratos y subvenciones publicados, agrupados por ministerio responsable."
        actions={
          <div className="flex shrink-0 flex-wrap items-center gap-2 font-mono text-xs">
            {BUDGET_YEARS.slice()
              .reverse()
              .map((y) => (
                <ResponsiveLink
                  key={y}
                  href={`/dinero-publico?year=${y}`}
                  className={`rounded-[2px] border px-2 py-1 font-mono ${
                    y === year
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                  aria-current={y === year ? "page" : undefined}
                >
                  {y}
                </ResponsiveLink>
              ))}
          </div>
        }
      />

      <SourceFootnote
        sourceLabel="SEPG · PCSP · BDNS"
        lastChecked={lastChecked}
        latestRecordDate={
          sections
            .map((s) => s.latest_record_date)
            .filter((d): d is string => Boolean(d))
            .sort()
            .at(-1) ?? null
        }
        coverageLabel={`${sections.length} secciones · ${resolvedMinisters} con ministro resuelto${
          meta?.label ? ` · ${meta.label} ${year}` : ""
        }`}
      />

      {sections.length === 0 ? (
        <EmptyState
          title="Sin datos para este año"
          description="El presupuesto de este año aún no se ha ingestado o el cruce con contratos y subvenciones está vacío."
        />
      ) : (
        <>
          <StatGrid
            items={[
              { label: `Crédito inicial ${year}`, value: formatAmount(totalCredit) },
              { label: "Programas", value: totalPrograms.toLocaleString("es-ES") },
              { label: "Contratos asociados", value: totalContractCount.toLocaleString("es-ES") },
              { label: "Subvenciones asociadas", value: totalSubsidyCount.toLocaleString("es-ES") },
              ...(cascadeEuFundTotal > 0
                ? [{ label: "Fondos UE vinculados", value: formatAmount(cascadeEuFundTotal), hint: `${sectionsWithEuFunds} secciones con fondos UE detectados en las organizaciones beneficiarias` }]
                : []),
            ]}
          />

          <p className="text-xs leading-5 text-muted-foreground">
            El cruce con contratos y subvenciones se hace por nombre normalizado de ministerio.
            La cobertura es desigual: muchas secciones presupuestarias no tienen aún registros
            cruzados y se muestran como{" "}
            <span className="font-mono text-muted-foreground">Sin datos</span>. Los fondos
            europeos se vinculan a través de las organizaciones beneficiarias cuando coinciden
            con adjudicatarias de contratos o beneficiarias de subvenciones.
          </p>

          <MoneyFlowExplorer
            year={year}
            sections={sections}
            initialSectionCode={searchParams?.section ?? null}
            initialProgramCode={searchParams?.program ?? null}
          />

          {/* Global EU fund context */}
          {euSummary && (
            <section className="rounded-[2px] border border-border bg-card px-5 py-4">
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Fondos europeos en España
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {Number(euSummary.beneficiary_count).toLocaleString("es-ES")} beneficiarios ·{" "}
                    {formatAmount(Number(euSummary.total_eu_budget))} de presupuesto UE ·{" "}
                    {Number(euSummary.total_projects).toLocaleString("es-ES")} proyectos
                  </p>
                </div>
                <ResponsiveLink
                  href="/fondos-ue"
                  className="shrink-0 text-xs underline-offset-2 hover:underline"
                >
                  Ver todos los fondos UE →
                </ResponsiveLink>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Fuente: Kohesio · Comisión Europea · Fondos Estructurales ESIF 2014-2027.
                La vinculación con la cascada presupuestaria es por nombre de organización:
                cuando una organización recibe contratos o subvenciones de un ministerio
                y además figura como beneficiaria de fondos europeos, el importe UE aparece
                en el desplegable de esa sección.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
