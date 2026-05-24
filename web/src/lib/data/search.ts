import { supabase } from "@/lib/supabase/client"
import { type SearchResult } from "./shared"

export type { SearchResult }

function mapSearchResult(row: SearchResult): SearchResult {
  const official =
    typeof row.metadata?.official_name === "string" ? row.metadata.official_name : row.official_name ?? null
  return official ? { ...row, official_name: official } : row
}

function isNameLikeQuery(normalized: string): boolean {
  if (/\d/.test(normalized)) return false
  if (/\b(subvencion|subvenciones|bdns|contrato|contratos|licitacion|pcsp|presupuesto|presupuestos|pge|importe|pension|pensiones|jubilacion|seguridad social|clases pasivas)\b/.test(normalized)) return false
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return false
  if (tokens.length === 1) {
    const token = tokens[0]
    if (token.length < 5) return false
    if (token === token.toUpperCase() && token.length <= 5) return false
    return /^[a-z-]+$/.test(token)
  }
  return tokens.every((token) => /^[a-z-]+$/.test(token))
}

function inferSearchEntityTypes(query: string): SearchResult["entity_type"][] | null {
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (isNameLikeQuery(normalized)) {
    return ["politician", "senator", "government_position", "institution", "organization"]
  }

  if (/\b(subvencion|subvenciones|bdns)\b/.test(normalized)) return ["subsidy"]
  if (/\b(contrato|contratos|licitacion|pcsp)\b/.test(normalized)) return ["contract"]
  if (/\b(presupuesto|presupuestos|pge|programa|pension|pensiones|jubilacion|seguridad social|clases pasivas)\b/.test(normalized)) return ["budget", "budget_program"]
  if (/\b(indicador|indicadores|ipc|deuda|pib)\b/.test(normalized)) return ["indicator"]
  if (/\b(corrupcion|judicial|juzgado|tribunal|condena|procesamiento|juicio oral)\b/.test(normalized)) return ["judicial_case"]
  if (/\b(iniciativa|iniciativas|ley|boe|normativa)\b/.test(normalized)) return ["initiative", "source_document"]
  if (/\b(voto|vota|votacion|votaciones|grupo|divergencia|divergencias)\b/.test(normalized)) {
    return ["vote_divergence", "voting_session"]
  }
  if (/\b(senador|senadora|senado)\b/.test(normalized)) return ["senator"]
  if (/\b(diputado|diputada|persona|personas)\b/.test(normalized)) {
    return ["politician", "senator", "government_position", "institution"]
  }
  if (/\b(empresa|empresas|organizacion|organizaciones|entidad|entidades|fundacion|asociacion)\b/.test(normalized)) {
    return ["organization"]
  }
  return null
}

function collapseBudgetProgramRoutes(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  const collapsed: SearchResult[] = []
  for (const result of results) {
    const key =
      result.entity_type === "budget_program" && result.url
        ? `${result.entity_type}:${result.url}`
        : `${result.entity_type}:${result.id}`
    if (seen.has(key)) continue
    seen.add(key)
    collapsed.push(result)
  }
  return collapsed
}

export async function searchGlobal(query: string, maxPerType = 5): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const { data } = await supabase.rpc("search_global", {
    query_text: query.trim(),
    max_per_type: maxPerType,
  })
  return collapseBudgetProgramRoutes(((data ?? []) as SearchResult[]).map(mapSearchResult))
}

export async function searchDocuments(
  query: string,
  options: { entityTypes?: SearchResult["entity_type"][]; filters?: Record<string, unknown>; limit?: number } = {}
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const entityTypes = options.entityTypes ?? inferSearchEntityTypes(query)
  const { data, error } = await supabase.rpc("search_documents", {
    query_text: query.trim(),
    entity_types: entityTypes,
    filters: options.filters ?? {},
    limit_count: options.limit ?? 24,
  })
  if (error) {
    console.error("searchDocuments:", error.message)
    return searchGlobal(query, Math.max(1, Math.ceil((options.limit ?? 24) / 8)))
  }
  return collapseBudgetProgramRoutes(((data ?? []) as SearchResult[]).map(mapSearchResult))
}

export async function searchSuggestions(query: string, limit = 12): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return []
  const { data, error } = await supabase.rpc("search_suggestions", {
    query_text: query.trim(),
    limit_count: limit,
  })
  if (error) {
    console.error("searchSuggestions:", error.message)
    return searchDocuments(query, { limit })
  }
  return collapseBudgetProgramRoutes(((data ?? []) as SearchResult[]).map(mapSearchResult))
}
