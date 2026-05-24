import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE } from "./shared"

export type DeclarationListRow = {
  id: string
  politician_id: string
  declaration_date: string | null
  source_url: string | null
  politician_name: string | null
  raw_data: Record<string, unknown> | null
}

export type DeclarationRegisterRow = {
  id: string
  politician_id: string
  politician_name: string | null
  declaration_date: string | null
  source_url: string | null
  declared_income: number | null
  irpf_paid: number | null
  inmuebles_mentioned: number | null
  vehiculos_mentioned: number | null
  financial_assets_mentioned: number | null
  ocr_status: string | null
}

export const getDeclarationsRegister = unstable_cache(
  async (): Promise<DeclarationRegisterRow[]> => {
    const { data } = await supabase.rpc("get_declarations_register")
    return (data ?? []) as DeclarationRegisterRow[]
  },
  ["declarations-register"],
  { revalidate: HOUR * 6 }
)

export type DeclarationType = "bienes_rentas" | "actividades" | "intereses_economicos"

export const getDeclarationsPage = unstable_cache(
  async (page: number, type?: DeclarationType) => {
    const from = (page - 1) * PAGE_SIZE.declarations
    const to = from + PAGE_SIZE.declarations - 1

    let query = supabase
      .from("economic_declarations")
      .select(
        "id, politician_id, declaration_date, source_url, raw_data, politician:politicians(full_name)",
        { count: "exact" }
      )
      .order("declaration_date", { ascending: false, nullsFirst: false })
      .range(from, to)

    if (type) {
      query = query.filter("raw_data->>type", "eq", type)
    }

    const { data, count } = await query

    const rows: DeclarationListRow[] = (data ?? []).map((r) => {
      const pol = r.politician as { full_name: string | null } | { full_name: string | null }[] | null
      const name = Array.isArray(pol) ? pol[0]?.full_name ?? null : pol?.full_name ?? null
      return {
        id: r.id as string,
        politician_id: r.politician_id as string,
        declaration_date: (r.declaration_date as string | null) ?? null,
        source_url: (r.source_url as string | null) ?? null,
        politician_name: name,
        raw_data: (r.raw_data as Record<string, unknown> | null) ?? null,
      }
    })
    return { declarations: rows, total: count ?? 0 }
  },
  ["declarations-page"],
  { revalidate: HOUR }
)
