import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE } from "./shared"

export type DeclarationListRow = {
  id: string
  politician_id: string
  declaration_date: string | null
  source_url: string | null
  politician_name: string | null
}

export const getDeclarationsPage = unstable_cache(
  async (page: number) => {
    const from = (page - 1) * PAGE_SIZE.declarations
    const to = from + PAGE_SIZE.declarations - 1
    const { data, count } = await supabase
      .from("economic_declarations")
      .select(
        "id, politician_id, declaration_date, source_url, politician:politicians(full_name)",
        { count: "exact" }
      )
      .order("declaration_date", { ascending: false, nullsFirst: false })
      .range(from, to)

    const rows: DeclarationListRow[] = (data ?? []).map((r) => {
      const pol = r.politician as { full_name: string | null } | { full_name: string | null }[] | null
      const name = Array.isArray(pol) ? pol[0]?.full_name ?? null : pol?.full_name ?? null
      return {
        id: r.id as string,
        politician_id: r.politician_id as string,
        declaration_date: (r.declaration_date as string | null) ?? null,
        source_url: (r.source_url as string | null) ?? null,
        politician_name: name,
      }
    })
    return { declarations: rows, total: count ?? 0 }
  },
  ["declarations-page"],
  { revalidate: HOUR }
)
