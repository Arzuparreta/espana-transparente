import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { SearchResult } from "@/lib/data"
import { EmptyState } from "@/components/domain/EmptyState"

const TYPE_LABEL: Record<SearchResult["entity_type"], string> = {
  politician: "Diputados",
  senator: "Senado",
  party: "Partidos",
  government_position: "Gobierno",
  institution: "Instituciones",
  organization: "Organizaciones",
  voting_session: "Votaciones",
  vote_divergence: "Divergencias",
  contract: "Contratos",
  subsidy: "Subvenciones",
  initiative: "Iniciativas",
  budget: "Presupuestos",
  budget_program: "Programas",
  indicator: "Indicadores",
  eu_fund: "Fondos UE",
  revolving_door: "Puertas giratorias",
  source_document: "Fuentes",
}

const TYPE_ORDER: SearchResult["entity_type"][] = [
  "politician",
  "senator",
  "government_position",
  "institution",
  "vote_divergence",
  "voting_session",
  "initiative",
  "contract",
  "subsidy",
  "budget",
  "budget_program",
  "indicator",
  "organization",
  "party",
  "eu_fund",
  "revolving_door",
  "source_document",
]

interface Props {
  query: string
  results: SearchResult[]
}

export function SearchResults({ query, results }: Props) {
  if (!query || query.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Escribe al menos 2 caracteres para buscar.
      </p>
    )
  }

  if (results.length === 0) {
    return (
      <EmptyState
        title="Sin resultados"
        description={`No se encontró nada para “${query}”.`}
      />
    )
  }

  const byType = new Map<SearchResult["entity_type"], SearchResult[]>()
  for (const r of results) {
    const group = byType.get(r.entity_type) ?? []
    group.push(r)
    byType.set(r.entity_type, group)
  }

  const orderedTypes = TYPE_ORDER.filter((t) => byType.has(t))

  return (
    <div className="space-y-6">
      {orderedTypes.map((type) => (
        <section key={type}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {TYPE_LABEL[type]}
          </h2>
          <ul className="space-y-1">
            {byType.get(type)!.map((result) => {
              const secondary =
                result.official_name && result.official_name !== result.title
                  ? result.official_name
                  : result.subtitle
              return (
                <li key={`${result.entity_type}-${result.id}`}>
                  <ResponsiveLink
                    href={result.url}
                    className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm transition-colors hover:border-border hover:bg-card sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  >
                    <span className="min-w-0 truncate font-medium">{result.title}</span>
                    {secondary ? (
                      <span className="shrink-0 text-xs text-muted-foreground sm:text-right">{secondary}</span>
                    ) : null}
                  </ResponsiveLink>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        {results.length} resultado{results.length !== 1 ? "s" : ""} para{" "}
        <span className="font-medium">&ldquo;{query}&rdquo;</span>
      </p>
    </div>
  )
}
