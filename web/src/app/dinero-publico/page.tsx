import { EmptyState } from "@/components/domain/EmptyState"
import { MoneyCascade } from "@/components/domain/MoneyCascade"
import { MoneyCascadeHashFocus } from "@/components/domain/MoneyCascadeHashFocus"
import { PageHeader } from "@/components/domain/PageHeader"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { StatGrid } from "@/components/domain/StatGrid"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import {
  BUDGET_YEARS,
  getBudgetYearMeta,
  getEtlLastFinished,
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

  const [sections, lastChecked] = await Promise.all([
    getMoneyFlowYear(year),
    getEtlLastFinished(["presupuestos", "contracts_daily", "subsidies_daily"]),
  ])

  const totalCredit = sections.reduce((sum, s) => sum + s.total_credit_initial, 0)
  const totalPrograms = sections.reduce((sum, s) => sum + s.programs.length, 0)
  const totalContractCount = sections.reduce((sum, s) => sum + s.contract_count, 0)
  const totalSubsidyCount = sections.reduce((sum, s) => sum + s.subsidy_count, 0)
  const resolvedMinisters = sections.filter((s) => s.minister_name).length

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
            ]}
          />

          <p className="text-xs leading-5 text-muted-foreground">
            El cruce con contratos y subvenciones se hace por nombre normalizado de ministerio.
            La cobertura es desigual: muchas secciones presupuestarias no tienen aún registros
            cruzados y se muestran como{" "}
            <span className="font-mono text-muted-foreground">Sin datos</span>. Los fondos
            europeos se muestran a través de las páginas de organización de cada beneficiario.
            Iniciativas legislativas no entran todavía en este cruce.
          </p>

          <MoneyCascadeHashFocus />
          <MoneyCascade
            year={year}
            sections={sections}
            initialOpenSectionCode={searchParams?.section ?? null}
          />
        </>
      )}
    </div>
  )
}
