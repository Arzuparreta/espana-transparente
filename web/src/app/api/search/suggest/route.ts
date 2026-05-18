import { searchSuggestions, type SearchResult } from "@/lib/data"

type SuggestPayload = {
  results: SearchResult[]
}

type SearchEntityType = SearchResult["entity_type"]

function typeSet(values: SearchEntityType[]) {
  return new Set<SearchEntityType>(values)
}

function preferredTypes(query: string): Set<SearchResult["entity_type"]> {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (/\b(subvencion|subvenciones|bdns)\b/.test(normalized)) return typeSet(["subsidy"])
  if (/\b(contrato|contratos|licitacion|pcsp)\b/.test(normalized)) return typeSet(["contract"])
  if (/\b(presupuesto|presupuestos|pge|programa)\b/.test(normalized)) return typeSet(["budget", "budget_program"])
  if (/\b(indicador|indicadores|ipc|deuda|pib)\b/.test(normalized)) return typeSet(["indicator"])
  if (/\b(iniciativa|iniciativas|ley|boe|normativa)\b/.test(normalized)) return typeSet(["initiative", "source_document"])
  if (/\b(voto|vota|votacion|votaciones|grupo|divergencia|divergencias)\b/.test(normalized)) {
    return typeSet(["vote_divergence", "voting_session"])
  }
  if (/\b(senador|senadora|senado)\b/.test(normalized)) return typeSet(["senator"])
  if (/\b(diputado|diputada|persona|personas)\b/.test(normalized)) {
    return typeSet(["politician", "senator", "government_position", "institution"])
  }
  return typeSet([])
}

function cleanResults(results: SearchResult[], query: string, limit: number) {
  const preferred = preferredTypes(query)
  const seen = new Set<string>()
  const deduped: SearchResult[] = []

  for (const result of results) {
    const key = `${result.entity_type}:${result.id}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(result)
  }

  return deduped
    .sort((a, b) => {
      const aPreferred = preferred.has(a.entity_type) ? 1 : 0
      const bPreferred = preferred.has(b.entity_type) ? 1 : 0
      if (aPreferred !== bPreferred) return bPreferred - aPreferred
      return (b.rank ?? 0) - (a.rank ?? 0)
    })
    .slice(0, limit)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim() ?? ""
  const limit = Number.parseInt(searchParams.get("limit") ?? "12", 10)
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 20)) : 12

  if (query.length < 2) {
    return Response.json({ results: [] } satisfies SuggestPayload)
  }

  const results = await searchSuggestions(query, Math.max(safeLimit * 3, 24))
  return Response.json({ results: cleanResults(results, query, safeLimit) } satisfies SuggestPayload)
}
