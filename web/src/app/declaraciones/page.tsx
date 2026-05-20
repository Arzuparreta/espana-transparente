import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { PAGE_SIZE, parsePage } from "@/lib/data"
import { getDeclarationsPage } from "@/lib/data/declarations"

export const revalidate = 3600

export const metadata = {
  title: "Declaraciones económicas",
  description: "Declaraciones de bienes y rentas de los diputados del Congreso, con enlaces al PDF oficial.",
}

interface PageProps {
  searchParams?: {
    page?: string
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Documento vigente"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Documento vigente"
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function sourceHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export default async function DeclaracionesPage({ searchParams }: PageProps) {
  const page = parsePage(searchParams?.page)
  const { declarations, total } = await getDeclarationsPage(page)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.declarations))

  const latestRecordDate =
    declarations
      .map((d) => d.declaration_date)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1) ?? null

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Declaraciones económicas"
        description="Declaraciones de bienes y rentas presentadas por los diputados al ser elegidos y al cesar en el cargo."
      />

      <SourceFootnote
        sourceLabel="Congreso de los Diputados"
        sourceHref="https://www.congreso.es"
        latestRecordDate={latestRecordDate}
        coverageLabel={`${total.toLocaleString("es-ES")} declaraciones publicadas`}
      />

      {declarations.length === 0 ? (
        <EmptyState
          title="Sin declaraciones"
          description="No hay declaraciones publicadas en la muestra actual."
        />
      ) : (
        <ul className="space-y-2">
          {declarations.map((item) => {
            const host = sourceHost(item.source_url)
            return (
              <li key={item.id}>
                <div className="flex min-w-0 items-start justify-between gap-4 rounded-[2px] border border-border bg-card px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    {item.politician_name ? (
                      <ResponsiveLink
                        href={`/diputados/${item.politician_id}`}
                        className="block min-w-0 truncate text-sm font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        {item.politician_name}
                      </ResponsiveLink>
                    ) : (
                      <p className="truncate text-sm text-muted-foreground">Diputado sin nombre</p>
                    )}
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {formatDate(item.declaration_date)}
                      {host ? <span> · {host}</span> : null}
                    </p>
                  </div>
                  {item.source_url ? (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Ver PDF →
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(nextPage) => `/declaraciones?page=${nextPage}`}
      />
    </div>
  )
}
