import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { PAGE_SIZE, parsePage } from "@/lib/data"
import { getInitiativesPage } from "@/lib/data/conexiones"

export const revalidate = 3600

export const metadata = {
  title: "Iniciativas",
  description: "Proyectos de ley, proposiciones y mociones en tramitación parlamentaria.",
}

interface PageProps {
  searchParams?: {
    page?: string
  }
}

const TYPE_LABELS: Record<string, string> = {
  proyecto_ley: "Proyecto de Ley",
  proposicion_ley: "Proposición de Ley",
  propuesta_reforma_estatuto: "Propuesta de reforma",
  proposicion_no_de_ley: "Proposición no de Ley",
  mocion: "Moción",
  interpelacion: "Interpelación",
  pregunta: "Pregunta",
}

const STATUS_LABELS: Record<string, string> = {
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  retirada: "Retirada",
  en_tramitacion: "En tramitación",
  caducada: "Caducada",
  cerrada: "Cerrada",
}

export default async function IniciativasPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const { initiatives, total } = await getInitiativesPage(page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.initiatives))

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Iniciativas"
        description="Iniciativas legislativas del Congreso: proyectos de ley, proposiciones, mociones y otras propuestas en tramitación."
      />

      <SourceFootnote
        sourceLabel="Congreso de los Diputados"
        sourceHref="https://www.congreso.es"
        coverageLabel={`${total.toLocaleString("es-ES")} iniciativas registradas`}
      />

      {initiatives.length === 0 ? (
        <EmptyState
          title="Sin iniciativas registradas"
          description="El pipeline aún no ha ingerido iniciativas."
          action={
            <ResponsiveLink
              href="/estado-datos"
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Ver estado de los datos →
            </ResponsiveLink>
          }
        />
      ) : (
        <ul className="space-y-2">
          {initiatives.map((item) => {
            const typeLabel = item.type ? TYPE_LABELS[item.type] ?? item.type : null
            const statusLabel = item.status ? STATUS_LABELS[item.status] ?? item.status : null

            return (
              <li key={item.id}>
                <div className="flex min-w-0 items-start justify-between gap-4 rounded-[2px] border border-border bg-card px-4 py-3">
                  <ResponsiveLink
                    href={`/iniciativas/${item.id}`}
                    className="min-w-0 flex-1 space-y-1 transition-colors hover:text-foreground"
                  >
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {item.number ? (
                        <span className="font-mono">Exp. {item.number}</span>
                      ) : null}
                      {typeLabel ? <span>{typeLabel}</span> : null}
                      {item.proposer_group ? (
                        <span className="truncate">· {item.proposer_group}</span>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium leading-snug text-foreground line-clamp-2">
                      {item.title ?? item.number ?? "Iniciativa sin título"}
                    </p>
                  </ResponsiveLink>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {statusLabel ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {statusLabel}
                      </span>
                    ) : null}
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Fuente →
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(nextPage) => `/iniciativas?page=${nextPage}`}
      />
    </div>
  )
}
