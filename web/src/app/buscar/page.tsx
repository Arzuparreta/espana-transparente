import { redirect } from "next/navigation"
import { PageHeader } from "@/components/domain/PageHeader"
import { SearchResults } from "@/components/search/SearchResults"
import { searchDocumentPage } from "@/lib/data/search"
import { parsePage, type SearchResult } from "@/lib/data"
import { Pagination } from "@/components/domain/Pagination"
import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import { answersForQuery } from "@/lib/question-coverage"
export const metadata = { title: "Buscar datos" }
const TYPES: Partial<Record<SearchResult["entity_type"], string>> = {
  politician: "Diputados",
  senator: "Senadores",
  government_position: "Cargos públicos",
  organization: "Empresas y organizaciones",
  party: "Partidos",
  institution: "Instituciones",
  contract: "Contratos",
  subsidy: "Subvenciones",
  eu_fund: "Fondos europeos",
  budget: "Presupuestos",
  budget_program: "Programas",
  voting_session: "Votaciones",
  initiative: "Iniciativas",
  indicator: "Series económicas",
  revolving_door: "Puertas giratorias",
  judicial_case: "Procesos judiciales",
  source_document: "Fuentes",
  vote_divergence: "Divergencias",
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    type?: string
    year?: string
    page?: string
  }>
}) {
  const p = await searchParams
  const query = p.q?.trim() ?? ""
  const type =
    p.type && Object.hasOwn(TYPES, p.type)
      ? (p.type as SearchResult["entity_type"])
      : undefined
  const year = p.year && /^\d{4}$/.test(p.year) ? Number(p.year) : undefined
  const page = Math.min(10000, parsePage(p.page))
  const result = await searchDocumentPage(query, { type, year, page })
  // A topic query first gets the answers the portal can document, then the matching records.
  const answers = page === 1 && !type ? answersForQuery(query) : []
  const href = (next: number) => {
    const q = new URLSearchParams({ q: query, page: String(next) })
    if (type) q.set("type", type)
    if (year) q.set("year", String(year))
    return `/buscar?${q}`
  }
  if (!result.error && result.total > 0 && page > Math.ceil(result.total / 24))
    redirect(href(Math.ceil(result.total / 24)))
  return (
    <div className="ui-page space-y-5">
      <PageHeader
        title="Buscar datos"
        description="Encuentra una persona, entidad, operación o serie y sigue sus relaciones documentadas."
      />
      <form action="/buscar" className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm">
          Qué buscas
          <input
            key={query}
            name="q"
            defaultValue={query}
            minLength={2}
            required
            className="mt-1 block w-full rounded border border-border bg-background p-2"
          />
        </label>
        <label className="text-sm">
          Colección
          <select
            key={type}
            name="type"
            defaultValue={type ?? ""}
            className="mt-1 block max-w-full rounded border border-border bg-background p-2"
          >
            <option value="">Todos los datos</option>
            {Object.entries(TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Año del registro
          <input
            key={year}
            name="year"
            type="number"
            min="1900"
            max="2100"
            defaultValue={year}
            placeholder="Todos"
            className="mt-1 block w-28 rounded border border-border bg-background p-2"
          />
        </label>
        <button className="rounded bg-foreground px-4 py-2 text-background">
          Buscar
        </button>
      </form>
      {year && (
        <p className="text-xs text-muted-foreground">
          Solo registros fechados en {year}. Las entidades sin fecha no se
          incluyen.
        </p>
      )}
      {result.error ? (
        <p role="alert">
          No se ha podido consultar la búsqueda. Vuelve a intentarlo; esto no
          significa que no existan datos.
        </p>
      ) : (
        <>
          {answers.length > 0 && (
            <section aria-labelledby="topic-answers" className="space-y-3">
              <h2 id="topic-answers" className="text-lg font-semibold">
                Respuestas documentadas sobre «{query}»
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {answers.map((answer) => (
                  <li key={answer.href + answer.question} className="min-w-0 space-y-1 rounded-[2px] border border-border p-4 text-sm leading-6">
                    <ResponsiveLink href={answer.href} className="block font-semibold underline-offset-2 hover:underline">
                      {answer.question}
                    </ResponsiveLink>
                    <p>{answer.covers}.</p>
                    <p className="text-muted-foreground">No cubre: {answer.excludes}.</p>
                  </li>
                ))}
              </ul>
              <h2 className="text-lg font-semibold">Registros que contienen «{query}»</h2>
              <p className="text-xs text-muted-foreground">
                La búsqueda encuentra registros por su texto: no todos están clasificados por tema y un registro no es una respuesta completa.
              </p>
            </section>
          )}
          {query.length >= 2 && (
            <p role="status" className="text-sm">
              {result.total.toLocaleString("es-ES")} resultados · página {page}
            </p>
          )}
          <SearchResults query={query} results={result.results} />
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(result.total / 24))}
            hrefForPage={href}
          />
        </>
      )}
    </div>
  )
}
