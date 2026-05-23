import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getJudicialCasesPage, JUDICIAL_STATUS_LABEL, PAGE_SIZE, parsePage } from "@/lib/data"
import type { JudicialStatus } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Procesos judiciales",
  description: "Procedimientos publicados por fuentes judiciales oficiales y vínculos revisados.",
}

interface PageProps {
  searchParams?: { page?: string }
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha publicada"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Sin fecha publicada"
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default async function CorrupcionPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const { cases, total } = await getJudicialCasesPage(page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.judicialCases))
  const latestRecordDate =
    cases
      .map((item) => item.last_verified_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null

  return (
    <div className="ui-page">
      <PageHeader
        title="Procesos judiciales"
        description="Procedimientos publicados por fuentes oficiales. Los vínculos con personas, organizaciones, contratos o subvenciones solo se muestran cuando han sido revisados."
      />

      <SourceFootnote
        sourceLabel="CGPJ y fuentes judiciales oficiales"
        sourceHref="https://www.poderjudicial.es/cgpj/es/Temas/Transparencia/Repositorio-de-datos-sobre-procesos-por-corrupcion/"
        latestRecordDate={latestRecordDate}
        coverageLabel={`${total.toLocaleString("es-ES")} registros publicados`}
      />

      {cases.length === 0 ? (
        <EmptyState
          title="Sin procesos publicados"
          description="No hay registros judiciales publicados en la muestra actual."
        />
      ) : (
        <ul className="space-y-2">
          {cases.map((item) => (
            <li key={item.id}>
              <div className="rounded-[2px] border border-border bg-card px-4 py-3">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <ResponsiveLink
                      href={`/corrupcion/${item.id}`}
                      className="block min-w-0 text-sm font-medium underline-offset-2 hover:underline"
                    >
                      {item.title}
                    </ResponsiveLink>
                    <p className="text-xs text-muted-foreground">
                      {JUDICIAL_STATUS_LABEL[item.procedural_status as JudicialStatus]}
                      {item.court_body ? ` · ${item.court_body}` : ""}
                      {item.territory ? ` · ${item.territory}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-left font-mono text-xs text-muted-foreground sm:text-right">
                    <div>{formatDate(item.source_published_at)}</div>
                    <div>
                      {item.reviewed_actor_count} actores · {item.reviewed_link_count} vínculos
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(nextPage) => `/corrupcion?page=${nextPage}`}
      />
    </div>
  )
}
