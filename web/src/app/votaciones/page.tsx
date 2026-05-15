import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExceptionBadge } from "@/components/domain/ExceptionBadge"
import { PageHeader } from "@/components/domain/PageHeader"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { PAGE_SIZE, getVotingSessionPage, parsePage } from "@/lib/data"

export const revalidate = 3600

interface SessionRow {
  id: string
  title: string
  session_number: number
  date: string
  initiative_number?: string
  votes: Array<{ count: number }>
  vote_count?: number
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
        description="Sesiones de votación de la XV Legislatura. Cada sesión incluye el voto individual de cada diputado y las divergencias detectadas respecto a la mayoría de su grupo parlamentario."
        actions={
          <ResponsiveLink
            href="/distorsion"
            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Ver divergencias de voto →
          </ResponsiveLink>
        }
      />

      <div className="space-y-3">
        {(sessions as unknown as SessionRow[])?.map((s) => {
          const dateStr = s.date
            ? new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
            : ""
          const divCount = s.divergence_count ?? 0
          const voteCount = s.vote_count ?? s.votes?.[0]?.count ?? 0

          return (
            <ResponsiveLink key={s.id} href={`/votaciones/${s.id}`}>
              <Card className="ui-card-link cursor-pointer bg-card/85">
                <CardContent className="flex items-start gap-3 py-4 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-medium leading-6 text-balance">{s.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Sesión {s.session_number} · {dateStr}
                      </span>
                      <Badge variant="outline" className="h-5 shrink-0 text-[10px]">
                        {voteCount} votos
                      </Badge>
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

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4 text-sm">
          <ResponsiveLink
            href={`/votaciones?page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            className={`rounded-full border border-border/70 px-3 py-2 ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"
            }`}
          >
            Anterior
          </ResponsiveLink>
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <ResponsiveLink
            href={`/votaciones?page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page >= totalPages}
            className={`rounded-full border border-border/70 px-3 py-2 ${
              page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted"
            }`}
          >
            Siguiente
          </ResponsiveLink>
        </div>
      ) : null}
    </div>
  )
}
