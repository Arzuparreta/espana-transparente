import { EmptyState } from "@/components/domain/EmptyState"
import { PageHeader } from "@/components/domain/PageHeader"
import { Pagination } from "@/components/domain/Pagination"
import { SourceFootnote } from "@/components/domain/SourceFootnote"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { getEtlLastFinished, getLobbyingGroupsPage, PAGE_SIZE, parsePage } from "@/lib/data"

export const revalidate = 3600

export const metadata = {
  title: "Grupos de interés",
  description:
    "Registro de Grupos de Interés de la CNMC: organizaciones inscritas que intentan influir en la regulación y la política pública.",
}

interface PageProps {
  searchParams?: Promise<{ page?: string; category?: string; q?: string }>
}

export default async function GruposDeInteresPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parsePage(params?.page)
  const activeCategory = params?.category?.trim() || null
  const query = params?.q?.trim() || null

  const [{ groups, total, categories }, lastChecked] = await Promise.all([
    getLobbyingGroupsPage(page, activeCategory, query),
    getEtlLastFinished(["lobbying.rgi"]),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE.lobbyingGroups))

  return (
    <div className="ui-page">
      <PageHeader
        title="Grupos de interés"
        description={`Organizaciones inscritas en el Registro de Grupos de Interés de la CNMC. Cada entrada representa una entidad que declara intentar influir en reguladores o poderes públicos. ${total.toLocaleString("es-ES")} registros.`}
      />

      <SourceFootnote
        sourceLabel="CNMC — Registro de Grupos de Interés"
        sourceHref="https://rgi.cnmc.es/"
        lastChecked={lastChecked}
        coverageLabel={`${total.toLocaleString("es-ES")} registros`}
      />

      {/* Search + category filters */}
      <div className="space-y-3">
        <form className="flex flex-col gap-3 rounded-[2px] border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <input
            type="search"
            name="q"
            defaultValue={query ?? undefined}
            placeholder="Buscar por nombre…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Buscar grupos de interés"
          />
          <button
            type="submit"
            className="shrink-0 rounded-[2px] border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Buscar
          </button>
        </form>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
             <ResponsiveLink
              href={`/grupos-de-interes${query ? `?q=${encodeURIComponent(query)}` : ""}`}
              className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                !activeCategory
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </ResponsiveLink>
            {categories.map((cat) => (
              <ResponsiveLink
                key={cat}
                href={`/grupos-de-interes?category=${encodeURIComponent(cat)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </ResponsiveLink>
            ))}
          </div>
        )}
      </div>

      {(activeCategory || query) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {total.toLocaleString("es-ES")} {total === 1 ? "registro" : "registros"}
            {activeCategory ? ` en «${activeCategory}»` : ""}
            {query ? ` para «${query}»` : ""}
          </span>
          <ResponsiveLink
            href="/grupos-de-interes"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Limpiar filtros
          </ResponsiveLink>
        </div>
      )}

      {groups.length === 0 ? (
        <EmptyState
          title="Sin registros"
          description={
            activeCategory || query
              ? "Ningún grupo coincide con los filtros aplicados."
              : "No hay grupos de interés publicados en la muestra actual."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[2px] border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Organización</th>
                <th className="hidden px-4 py-3 text-left font-medium sm:table-cell">Categoría</th>
                <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Subcategoría</th>
                <th className="px-4 py-3 text-right font-medium">Enlace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {groups.map((g) => (
                <tr key={g.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <ResponsiveLink
                      href={`/grupos-de-interes/${g.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {g.name}
                    </ResponsiveLink>
                    {g.objectives && (
                      <div className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                        {g.objectives}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {g.category ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {g.subcategory ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={g.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      CNMC →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        hrefForPage={(p) => {
          const qs = new URLSearchParams()
          if (p > 1) qs.set("page", String(p))
          if (activeCategory) qs.set("category", activeCategory)
          if (query) qs.set("q", query)
          const s = qs.toString()
          return `/grupos-de-interes${s ? `?${s}` : ""}`
        }}
      />
    </div>
  )
}
