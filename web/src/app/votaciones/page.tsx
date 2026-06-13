import { Card, CardContent } from "@/components/ui/card"
import { ExceptionBadge } from "@/components/domain/ExceptionBadge"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getVoteColor } from "@/lib/domain-style"
import { PAGE_SIZE, getEtlLastFinished, getVotingSessionPage, parsePage } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Votaciones",
  description: "Sesiones de votación del Congreso y el Senado: resultados, asistencia y divergencias dentro de cada grupo.",
}

interface SessionRow {
  id: string
  title: string
  session_number: number
  date: string
  initiative_number?: string
  divergence_count?: number
  chamber?: string
  votes_yes?: number
  votes_no?: number
  votes_abstain?: number
}

interface PageProps {
  searchParams?: {
    page?: string
  }
}

export default async function VotacionesPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const [{ sessions, total }, lastChecked] = await Promise.all([
    getVotingSessionPage(page),
    getEtlLastFinished(["congreso.asistencia", "senado.votaciones"]),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.votingSessions))
  const latestRecordDate =
    (sessions as unknown as { date: string }[])
      .map((s) => s.date)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null

  return (
    <div className="ui-page space-y-6 sm:space-y-8">
      <PageHeader
        title="Votaciones"
        description="Sesiones con voto nominal: resultado, voto individual y divergencias dentro de cada grupo."
        actions={
          <ResponsiveLink
            href="/divergencias"
            className="inline-flex min-h-11 shrink-0 items-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ranking de divergencias de voto →
          </ResponsiveLink>
        }
      />

      <SourceFootnote
        sourceLabel="Congreso de los Diputados · Senado"
        lastChecked={lastChecked}
        latestRecordDate={latestRecordDate}
        coverageLabel={`${total.toLocaleString("es-ES")} votaciones nominales`}
      />

      <div className="space-y-3">
        {(sessions as unknown as SessionRow[]).length === 0 ? (
          <EmptyState title="Sin votaciones" description="No hay sesiones publicadas en la muestra actual." />
        ) : null}
        {(sessions as unknown as SessionRow[])?.map((s) => {
          const dateStr = s.date
            ? new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
            : ""
          const divCount = s.divergence_count ?? 0
          const titleParts = s.title.split(/\.\s+-\s+/, 2)
          const tipo = titleParts.length === 2 ? titleParts[0].trim() : null
          const descripcion = titleParts.length === 2 ? titleParts[1].trim() : s.title
          const yes = s.votes_yes ?? 0
          const no = s.votes_no ?? 0
          const abstain = s.votes_abstain ?? 0
          const hasResult = yes + no + abstain > 0
          const outcome = hasResult ? (yes > no ? "Aprobada" : "Rechazada") : null

          return (
            <ResponsiveLink key={s.id} href={`/votaciones/${s.id}`}>
              <Card>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-5">
                  <div className="min-w-0 flex-1">
                    {tipo ? (
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {tipo}
                      </p>
                    ) : null}
                    <div className={`${tipo ? "mt-1.5" : ""} text-base font-medium leading-6 text-balance`}>
                      {descripcion}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {s.chamber === "senate" ? "Senado" : "Congreso"} · Sesión {s.session_number} · {dateStr}
                      </span>
                      {divCount > 0 && <ExceptionBadge count={divCount} />}
                    </div>
                  </div>
                  {hasResult ? (
                    <div className="flex shrink-0 items-center gap-4 sm:w-40 sm:flex-col sm:items-end sm:gap-1.5">
                      <span
                        className="font-mono text-xs font-semibold uppercase tracking-wide"
                        style={{ color: yes > no ? getVoteColor("Sí") : getVoteColor("No") }}
                      >
                        {outcome}
                      </span>
                      <div className="flex shrink-0 gap-3 font-mono text-xs tabular-nums text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 shrink-0" style={{ backgroundColor: getVoteColor("Sí") }} />
                          {yes}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 shrink-0" style={{ backgroundColor: getVoteColor("No") }} />
                          {no}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 shrink-0" style={{ backgroundColor: getVoteColor("Abstención") }} />
                          {abstain}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </ResponsiveLink>
          )
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} hrefForPage={(nextPage) => `/votaciones?page=${nextPage}`} />
    </div>
  )
}
