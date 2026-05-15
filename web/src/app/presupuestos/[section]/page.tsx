import { PageHeader } from "@/components/domain/PageHeader"
import { InfoPanel } from "@/components/domain/InfoPanel"
import { Card, CardContent } from "@/components/ui/card"
import { BUDGET_YEARS, getBudgetMinister, getBudgetSection } from "@/lib/data"
import { notFound } from "next/navigation"

export const revalidate = 3600

interface PageProps {
  params: { section: string }
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
  if (eur >= 1_000_000_000) return `${(eur / 1_000_000_000).toFixed(1)}B €`
  if (eur >= 1_000_000) return `${(eur / 1_000_000).toFixed(0)}M €`
  if (eur >= 1_000) return `${Math.round(eur / 1_000)}K €`
  return `${Math.round(eur)} €`
}

export default async function BudgetSectionPage({ params, searchParams }: PageProps) {
  const currentYear = new Date().getFullYear()
  const requestedYear = Number.parseInt(searchParams?.year ?? String(currentYear), 10)
  const year = BUDGET_YEARS.includes(requestedYear) ? requestedYear : currentYear
  const sectionCode = decodeURIComponent(params.section)

  const [programs, minister] = await Promise.all([
    getBudgetSection(year, sectionCode),
    getBudgetMinister(year, sectionCode),
  ])

  if (programs.length === 0) {
    notFound()
  }

  const sectionName = programs[0]?.section_name ?? sectionCode
  const totalInitial = programs.reduce((sum, p) => sum + (p.total_credit_initial ?? 0), 0)
  const totalFinal = programs.reduce((sum, p) => sum + (p.total_credit_final ?? 0), 0)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={sectionName}
        description={`Sección ${sectionCode} · Presupuesto ${year}`}
        eyebrow={
          minister?.minister_name ? (
            <span className="text-xs text-muted-foreground">
              Ministro/a responsable: <span className="font-medium text-foreground">{minister.minister_name}</span>
            </span>
          ) : null
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums">{formatAmount(totalInitial)}</div>
          <div className="text-xs text-muted-foreground">Crédito inicial</div>
        </div>
        {Math.abs(totalFinal - totalInitial) > 1 ? (
          <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
            <div className="text-2xl font-semibold tabular-nums">{formatAmount(totalFinal)}</div>
            <div className="text-xs text-muted-foreground">Crédito definitivo</div>
          </div>
        ) : null}
        <div className="rounded-xl border border-border/70 bg-card/70 px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums">{programs.length}</div>
          <div className="text-xs text-muted-foreground">Programas</div>
        </div>
      </div>

      {/* Program list */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Programas · ordenados por crédito inicial
        </div>
        {programs.map((p) => {
          const byChapter = (p.by_chapter ?? {}) as Record<string, { initial: number | null; final: number | null }>
          const chapters = Object.entries(byChapter)
            .filter(([, v]) => v.initial != null && v.initial > 0)
            .sort(([a], [b]) => Number(a) - Number(b))

          return (
            <Card key={p.program_code} className="bg-card/85">
              <CardContent className="px-4 py-4">
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{p.program_code}</span>
                      <span className="text-sm font-medium leading-snug">{p.program_name ?? "—"}</span>
                    </div>
                    {chapters.length > 0 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
                        {chapters.map(([ch, v]) => (
                          <span key={ch} className="text-[11px] text-muted-foreground">
                            {CHAPTER_NAMES[ch] ?? `Cap. ${ch}`}: {formatAmount(v.initial)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-base font-semibold tabular-nums">
                      {formatAmount(p.total_credit_initial)}
                    </div>
                    {p.total_credit_final != null &&
                    Math.abs(p.total_credit_final - (p.total_credit_initial ?? 0)) > 1 ? (
                      <div className="text-[11px] text-muted-foreground">
                        def: {formatAmount(p.total_credit_final)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <InfoPanel title="Fuente">
        Fuente: SEPG · Ministerio de Hacienda. Sección {sectionCode} del PGE {year}.
        Los capítulos muestran la clasificación económica del gasto (personal, corrientes, inversiones, transferencias).
      </InfoPanel>
    </div>
  )
}
