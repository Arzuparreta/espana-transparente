import { Card, CardContent } from "@/components/ui/card"
import { ExceptionBadge } from "@/components/domain/ExceptionBadge"
import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { PAGE_SIZE, getVotingSessionPage, parsePage } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Votaciones",
  description: "Sesiones de votación del Congreso: resultados, asistencia y divergencias dentro de cada grupo.",
}

interface SessionRow {
  id: string
  title: string
  session_number: number
  date: string
  initiative_number?: string
  divergence_count?: number
}

interface PageProps {
  searchParams?: {
    page?: string
  }
}

export default async function VotacionesPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const { sessions, total } = await getVotingSessionPage(page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.votingSessions))

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Votaciones"
        description="Cada vez que el Congreso aprueba o rechaza una ley o una propuesta, lo hace votando. Aquí ves quién votó qué, y qué diputados votaron diferente a su grupo."
        actions={
          <ResponsiveLink
            href="/distorsion"
            className="inline-flex min-h-11 shrink-0 items-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver divergencias de voto →
          </ResponsiveLink>
        }
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

          return (
            <ResponsiveLink key={s.id} href={`/votaciones/${s.id}`}>
              <Card>
                <CardContent className="flex items-start gap-3 py-4 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    {tipo ? (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {tipo}
                      </p>
                    ) : null}
                    <div className={`${tipo ? "mt-1.5" : ""} text-base font-medium leading-6 text-balance`}>
                      {descripcion}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        Sesión {s.session_number} · {dateStr}
                      </span>
                    </div>
                  </div>
                  {divCount > 0 && (
                    <ExceptionBadge count={divCount} />
                  )}
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
