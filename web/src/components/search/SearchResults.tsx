import { ResponsiveLink } from "@/components/navigation/NavigationProgress"
import type { SearchResult } from "@/lib/data"
import { EmptyState } from "@/components/domain/EmptyState"

const TYPE_LABEL: Record<SearchResult["entity_type"], string> = {
  politician: "Diputados",
  organization: "Organizaciones",
  voting_session: "Votaciones",
  contract: "Contratos",
  revolving_door: "Puertas giratorias",
}

const TYPE_ORDER: SearchResult["entity_type"][] = [
  "politician",
  "revolving_door",
  "voting_session",
  "contract",
  "organization",
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
            {byType.get(type)!.map((result) => (
              <li key={`${result.entity_type}-${result.id}`}>
                <ResponsiveLink
                  href={result.url}
                  className="flex min-w-0 items-baseline justify-between gap-4 rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-sm transition-colors hover:border-border hover:bg-card"
                >
                  <span className="min-w-0 truncate font-medium">{result.title}</span>
                  {result.subtitle ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{result.subtitle}</span>
                  ) : null}
                </ResponsiveLink>
              </li>
            ))}
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
