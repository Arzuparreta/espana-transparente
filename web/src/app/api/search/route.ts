import { searchDocuments, type SearchResult } from "@/lib/data"

type SearchPayload = {
  citations: {
    title: string
    url: string
    entityType: SearchResult["entity_type"]
    sourceUrl: string | null
  }[]
  resultCards: SearchResult[]
  suggestedFilters: {
    id: string
    label: string
    entityTypes: SearchResult["entity_type"][]
  }[]
}

const FILTERS: SearchPayload["suggestedFilters"] = [
  { id: "personas", label: "Personas", entityTypes: ["politician", "senator", "government_position", "institution"] },
  { id: "votaciones", label: "Votaciones", entityTypes: ["voting_session", "vote_divergence"] },
  { id: "dinero", label: "Dinero público", entityTypes: ["contract", "subsidy", "budget", "budget_program", "eu_fund"] },
  { id: "normativa", label: "Normativa", entityTypes: ["initiative"] },
  { id: "indicadores", label: "Indicadores", entityTypes: ["indicator"] },
  { id: "organizaciones", label: "Organizaciones", entityTypes: ["organization", "party"] },
  { id: "fuentes", label: "Fuentes", entityTypes: ["source_document", "revolving_door"] },
]

function citationsFrom(results: SearchResult[]): SearchPayload["citations"] {
  return results.slice(0, 6).map((result) => ({
    title: result.title,
    url: result.url || result.source_url || "",
    entityType: result.entity_type,
    sourceUrl: result.source_url ?? null,
  }))
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    query?: string
    entityTypes?: SearchResult["entity_type"][]
    filters?: Record<string, unknown>
    limit?: number
  } | null

  const query = body?.query?.trim() ?? ""
  if (query.length < 2) {
    return Response.json({
      citations: [],
      resultCards: [],
      suggestedFilters: FILTERS,
    } satisfies SearchPayload)
  }

  const results = await searchDocuments(query, {
    entityTypes: body?.entityTypes,
    filters: body?.filters ?? {},
    limit: body?.limit ?? 24,
  })

  return Response.json({
    citations: citationsFrom(results),
    resultCards: results,
    suggestedFilters: FILTERS,
  } satisfies SearchPayload)
}
