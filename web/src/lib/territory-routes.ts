import type { TerritoryScope } from "@/lib/data/multilevel"

// URL scope segment ↔ data-layer TerritoryScope. The hub uses a single
// `/territorio/[scope]/[key]` detail route; "ccaa" → autonomic, "municipio" →
// municipal. Type-only import keeps this safe to use from client components.
export const SCOPE_SEGMENT: Record<TerritoryScope, "ccaa" | "municipio"> = {
  autonomic: "ccaa",
  municipal: "municipio",
}

export const SEGMENT_SCOPE: Record<string, TerritoryScope> = {
  ccaa: "autonomic",
  municipio: "municipal",
}

export function territoryDetailHref(scope: TerritoryScope, territoryKey: string) {
  return `/territorio/${SCOPE_SEGMENT[scope]}/${encodeURIComponent(territoryKey)}`
}
