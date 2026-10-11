import { formatEuroCompact as formatAmount } from "@/lib/format"
import { summarizeMinistryAssociations } from "@/lib/money-associations"
import { EmptyState } from "@/components/domain/EmptyState"
import { MoneyFlowExplorer } from "@/components/domain/MoneyFlowExplorer"
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

export interface MoneyTraceabilityViewProps {
  searchParams?: {
    year?: string
    section?: string
    program?: string
  }
}

export async function MoneyTraceabilityView({ searchParams }: MoneyTraceabilityViewProps) {
  const latestYear = BUDGET_YEARS[BUDGET_YEARS.length - 1]
  const requestedYear = Number(searchParams?.year ?? latestYear)
  const year = BUDGET_YEARS.includes(requestedYear) ? requestedYear : latestYear
  const meta = getBudgetYearMeta(year)

  const [sections, lastChecked, euSummary] = await Promise.all([
    getMoneyFlowYear(year),
    getEtlLastFinished(["presupuestos", "contracts_daily", "subsidies_daily", "kohesio"]),
    getEuFundsSummary(),
  ])

  const totalCredit = sections.some((s) => s.total_credit_initial == null)
    ? null
    : sections.reduce((sum, s) => sum + (s.total_credit_initial ?? 0), 0)
  const totalPrograms = sections.reduce((sum, s) => sum + s.programs.length, 0)
  const { contractCount, subsidyCount } = summarizeMinistryAssociations(sections)

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="space-y-2 border-y border-border py-4" aria-label="Alcance de la trazabilidad">
        <h2 className="text-lg font-semibold">Presupuesto anual y operaciones asociadas por ministerio</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          El año selecciona créditos iniciales de los PGE, no gasto realizado.
          Las licitaciones, concesiones y principales receptores corresponden a todo el histórico disponible, sin filtro anual.
          Coincidir en ministerio no prueba que una operación se financie con un programa ni permite calcular su ejecución.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Los cargos mostrados son asociaciones del presupuesto; no acreditan firmas ni decisiones sobre estas operaciones históricas.
          Los datos de Kohesio son plurianuales y se asocian por nombre de organización, sin acreditar financiación europea de cada contrato o ayuda.
        </p>
      </section>
      <p className="font-mono text-xs text-muted-foreground">Año del presupuesto · {meta?.label} {year}</p>
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
        coverageLabel={`${sections.length} secciones presupuestarias${
          meta?.label ? ` · ${meta.label} ${year}` : ""
        }`}
      />

      {sections.length === 0 ? (
        <EmptyState
          title="Sin datos para este año"
          description="No hay créditos presupuestarios disponibles para este ejercicio. Esto no significa que el gasto sea cero."
        />
      ) : (
        <>
          <StatGrid
            items={[
              { label: `Crédito inicial ${year}`, value: formatAmount(totalCredit), hint: totalCredit == null ? "Hay créditos sin importe disponible; no se presenta una suma parcial como total." : "Suma de créditos iniciales de las secciones disponibles; no gasto realizado." },
              { label: "Programas", value: totalPrograms.toLocaleString("es-ES") },
              { label: "Licitaciones · histórico", value: contractCount.toLocaleString("es-ES"), hint: "Ministerios presentes en este presupuesto, contados una vez. No son operaciones del año seleccionado." },
              { label: "Concesiones · histórico", value: subsidyCount.toLocaleString("es-ES"), hint: "Ministerios presentes en este presupuesto, contados una vez. No son pagos." },
            ]}
          />

          <p className="text-xs leading-5 text-muted-foreground">
            Fuentes: <a className="underline" href="https://www.sepg.pap.hacienda.gob.es/">SEPG · créditos iniciales</a>,{" "}
            <a className="underline" href="https://contrataciondelestado.es/">PCSP · licitaciones</a> y{" "}
            <a className="underline" href="https://www.infosubvenciones.es/">BDNS · concesiones</a>.
            La asociación es por nombre normalizado de ministerio; las secciones que lo comparten repiten sus operaciones.
            No se suman los presupuestos UE entre ministerios: una organización puede figurar en varios.
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
                    Kohesio · contexto plurianual independiente
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
                  Ver beneficiarios en Kohesio →
                </ResponsiveLink>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Fuente: Kohesio · Comisión Europea · Fondos Estructurales ESIF 2014-2027.
                La asociación es por nombre de organización, no por expediente ni pago:
                cuando una organización figura en licitaciones o concesiones de un ministerio
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
