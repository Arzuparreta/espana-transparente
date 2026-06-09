import { notFound } from "next/navigation"
import { ContextTrail } from "@/components/navigation/ContextTrail"
import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { StatGrid } from "@/components/domain/StatGrid"
import { BudgetProvenanceBadge, BudgetProvenanceNote } from "@/components/presupuestos/BudgetProvenanceBadge"
import { getBudgetProgram, getBudgetSourceNote, getBudgetYearMeta } from "@/lib/data"

export const revalidate = 3600

interface PageProps {
  params: { section: string; program: string }
  searchParams?: { year?: string }
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

function formatAmount(eur: number | null): string {
  if (eur == null) return "—"
  if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(2).replace(".", ",")} mil M €`
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(1)} M €`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)} K €`
  return `${Math.round(eur)} €`
}

export async function generateMetadata({ params }: PageProps) {
  const sectionCode = decodeURIComponent(params.section)
  const programCode = decodeURIComponent(params.program)
  const rows = await getBudgetProgram(sectionCode, programCode)
  const latest = rows[0]
  return {
    title: latest?.program_name
      ? `${latest.program_name} · Programa ${programCode}`
      : `Programa ${programCode}`,
  }
}

export default async function BudgetProgramDetailPage({ params, searchParams }: PageProps) {
  const sectionCode = decodeURIComponent(params.section)
  const programCode = decodeURIComponent(params.program)
  const rows = await getBudgetProgram(sectionCode, programCode)
  if (rows.length === 0) notFound()

  const latest = rows[0]
  const programName = latest.program_name ?? programCode
  const sectionName = latest.section_name ?? sectionCode
  const ministry = latest.ministry_normalized
  const requestedYear = Number.parseInt(searchParams?.year ?? "", 10)
  const traceYear = rows.some((row) => row.year === requestedYear)
    ? requestedYear
    : latest.year

  return (
    <div className="ui-page">
      <ContextTrail
        section={{ href: "/presupuestos", label: "Presupuestos" }}
        current={programName}
        meta={`Programa ${programCode}`}
        fallbackHref={`/presupuestos/${encodeURIComponent(sectionCode)}`}
        fallbackLabel={`Volver a ${sectionName}`}
        related={[
          {
            href: `/presupuestos/${encodeURIComponent(sectionCode)}`,
            label: `Sección ${sectionCode}`,
            meta: sectionName,
          },
          latest?.year
            ? {
                href: `/dinero?view=trazabilidad&year=${traceYear}&section=${encodeURIComponent(sectionCode)}&program=${encodeURIComponent(programCode)}#program-${encodeURIComponent(programCode)}`,
                label: "Trazabilidad del gasto",
              }
            : null,
        ]}
      />
      <PageHeader
        title={programName}
        description={`Programa ${programCode} · Sección ${sectionCode} — ${sectionName}`}
        eyebrow={
          ministry ? (
            <span className="text-xs text-muted-foreground">{ministry}</span>
          ) : undefined
        }
      />

      <StatGrid
        items={[
          { label: "Años con datos", value: rows.length.toString() },
          {
            label: "Último crédito inicial",
            value: formatAmount(latest.total_credit_initial),
          },
          {
            label: "Último año",
            value: latest.year != null ? String(latest.year) : "—",
          },
        ]}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Histórico anual
        </h2>
        <div className="space-y-2">
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

            const isProrroga = row.source_kind === "carried_forward" || row.source_kind === "published_prorroga"

            return (
              <div
                key={row.year}
                className={"rounded-[2px] border bg-card px-4 py-3 " + (isProrroga ? "border-amber-300/60 dark:border-amber-800/60" : "border-border")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold">
                        {row.year}
                      </p>
                      {meta ? (
                        <span className="font-normal text-xs text-muted-foreground">
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
                          <span key={ch} className="text-xs text-muted-foreground">
                            {CHAPTER_NAMES[ch] ?? `Cap. ${ch}`}: {formatAmount(v.initial)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {sourceNote ? (
                      <p className="mt-1 text-xs text-muted-foreground">{sourceNote}</p>
                    ) : null}
                    <BudgetProvenanceNote sourceKind={row.source_kind} className="mt-1.5" />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-base font-semibold">
                      {formatAmount(row.total_credit_initial)}
                    </p>
                    {row.total_credit_final != null &&
                    Math.abs(row.total_credit_final - (row.total_credit_initial ?? 0)) > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        def: {formatAmount(row.total_credit_final)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <InfoPanel title="Fuente">
        SEPG · Ministerio de Hacienda. Programa {programCode} dentro de la sección {sectionCode}
        ({sectionName}). Los capítulos muestran la clasificación económica del gasto (personal,
        corrientes, inversiones, transferencias).
      </InfoPanel>
    </div>
  )
}
