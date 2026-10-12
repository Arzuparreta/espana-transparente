import { budgetEditionUrl, budgetYearSelection } from "@/lib/budget-context"
import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { RecordLayout } from "@/components/domain/RecordLayout"
import { RecordSection } from "@/components/domain/RecordSection"
import {
  BudgetProvenanceBadge,
  BudgetProvenanceNote,
} from "@/components/presupuestos/BudgetProvenanceBadge"
import {
  getBudgetProgram,
  getBudgetProgramEvidence,
  getBudgetSourceNote,
  getBudgetYearMeta,
} from "@/lib/data"
import { formatEuroCompact } from "@/lib/format"

export const revalidate = 3600

interface PageProps {
  params: Promise<{ section: string; program: string }>
  searchParams?: Promise<{ year?: string | string[] }>
}

const CHAPTER_NAMES: Record<string, string> = {
  "1": "Personal",
  "2": "Gastos corrientes",
  "3": "Gastos financieros",
  "4": "Transferencias corrientes",
  "6": "Inversiones reales",
  "7": "Transferencias de capital",
  "8": "Activos financieros",
  "9": "Pasivos financieros",
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const sectionCode = decodeURIComponent((await params).section)
  const programCode = decodeURIComponent((await params).program)
  const rows = await getBudgetProgram(sectionCode, programCode)
  const year = budgetYearSelection((await searchParams)?.year, rows.map(row => row.year).sort((a,b)=>a-b))
  const latest = rows.find(row => row.year === year)
  return {
    title: latest?.program_name
      ? `${latest.program_name} · Programa ${programCode}`
      : `Programa ${programCode}`,
  }
}

export default async function BudgetProgramDetailPage({
  params,
  searchParams,
}: PageProps) {
  const sectionCode = decodeURIComponent((await params).section)
  const programCode = decodeURIComponent((await params).program)
  const [rows, evidence] = await Promise.all([getBudgetProgram(sectionCode, programCode), getBudgetProgramEvidence(sectionCode, programCode)])
  if (rows.length === 0) notFound()

  const latest = rows[0]
  const traceYear = budgetYearSelection((await searchParams)?.year, rows.map(row => row.year).sort((a, b) => a - b))
  if (traceYear == null) notFound()
  const selected = rows.find(row => row.year === traceYear)!
  const programName = selected.program_name ?? programCode
  const sectionName = selected.section_name ?? sectionCode
  const ministry = selected.ministry_normalized

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/presupuestos", label: "Presupuestos" }}
        ancestors={[
          {
            href: `/presupuestos/${encodeURIComponent(sectionCode)}?year=${traceYear}`,
            label: sectionName,
          },
        ]}
        current={programName}
        meta={`Programa ${programCode}`}
        fallbackHref={`/presupuestos/${encodeURIComponent(sectionCode)}?year=${traceYear}`}
        fallbackLabel={`Volver a ${sectionName}`}
        related={[
          {
            href: `/presupuestos/${encodeURIComponent(sectionCode)}?year=${traceYear}`,
            label: `Sección ${sectionCode}`,
            meta: sectionName,
          },
          latest?.year
            ? {
                href: `/dinero-publico?year=${traceYear}&section=${encodeURIComponent(sectionCode)}&program=${encodeURIComponent(programCode)}#program-${encodeURIComponent(programCode)}`,
                label: "Trazabilidad del gasto",
              }
            : null,
        ]}
      />

      <RecordLayout
        hero={
          <PageHeader
            variant="record"
            eyebrow={
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Programa {programCode} · Sección {sectionCode}
                {ministry ? ` · ${ministry}` : ""}
              </span>
            }
            title={programName}
            description={`Sección ${sectionCode} — ${sectionName}`}
          />
        }
        aside={
          <InfoPanel title="Fuente">
            SEPG · Ministerio de Hacienda. Programa {programCode} dentro de la
            sección {sectionCode}({sectionName}). Los capítulos muestran la
            clasificación económica del gasto (personal, corrientes,
            inversiones, transferencias). Son dotaciones, no ejecución o pagos. Hasta 2023, extracción de Civio scraper-pge. Las referencias históricas conservan el CSV del ejercicio original.
          </InfoPanel>
        }
      >
        <StatGrid
          variant="flat"
          items={[
            { label: "Años con datos", value: rows.length.toString() },
            {
              label: selected.source_kind === "carried_forward" ? "Referencia de 2023" : `Crédito inicial ${traceYear}`,
              value: formatEuroCompact(selected.total_credit_initial),
            },
            {
              label: "Ejercicio seleccionado",
              value: String(traceYear),
            },
          ]}
        />

        <RecordSection title="Histórico anual" count={rows.length}>
          <div>
            {rows.map((row) => {
              const byChapter = (row.by_chapter ?? {}) as Record<
                string,
                { initial: number | null; final: number | null }
              >
              const chapters = Object.entries(byChapter)
                .filter(([, v]) => v.initial != null && v.initial > 0)
                .sort(([a], [b]) => Number(a) - Number(b))
              const meta = getBudgetYearMeta(row.year as number)
              const sourceNote = getBudgetSourceNote(row)
              const isProrroga =
                row.source_kind === "carried_forward" ||
                row.source_kind === "published_prorroga"

              return (
                <div
                  key={row.year}
                  className={
                    "border-t border-border/50 py-3 first:border-t-0 " +
                    (isProrroga
                      ? "border-l-2 border-l-amber-400/70 pl-3 dark:border-l-amber-600/60"
                      : "")
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold">
                          {row.year}
                        </p>
                        {meta ? (
                          <span className="text-xs font-normal text-muted-foreground">
                            · {meta.label}
                          </span>
                        ) : null}
                        <BudgetProvenanceBadge
                          sourceKind={row.source_kind}
                          sourceYear={row.source_year}
                          inForceYear={row.in_force_year}
                        />
                      </div>
                      {chapters.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {chapters.map(([ch, v]) => (
                            <span
                              key={ch}
                              className="text-xs text-muted-foreground"
                            >
                              {CHAPTER_NAMES[ch] ?? `Cap. ${ch}`}:{" "}
                              {formatEuroCompact(v.initial)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {sourceNote ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {sourceNote}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs leading-5"><a href={budgetEditionUrl(row.source_kind === "carried_forward" ? row.source_year ?? 2023 : row.year)} target="_blank" rel="noopener noreferrer" className="underline">Edición oficial</a>{" · "}{Array.from(new Set(evidence.filter(item => item.year === row.year).map(item => item.source_url).filter((url): url is string => !!url))).map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="mr-2 underline">CSV de origen {i + 1}</a>)}</p>
                      <BudgetProvenanceNote
                        sourceKind={row.source_kind}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-base font-semibold">
                        {formatEuroCompact(row.total_credit_initial)}
                      </p>
                      {row.total_credit_final != null &&
                      Math.abs(
                        row.total_credit_final -
                          (row.total_credit_initial ?? 0),
                      ) > 1 ? (
                        <p className="text-xs text-muted-foreground">
                          def: {formatEuroCompact(row.total_credit_final)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </RecordSection>
      </RecordLayout>
    </div>
  )
}
