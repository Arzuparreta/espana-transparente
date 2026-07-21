import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PAGE_SIZE, dataQuerySignal, dataErrorMessage } from "./shared"

export type DeclarationType = "bienes_rentas" | "actividades" | "intereses_economicos"

export type DeclarationSortField = "declared_income" | "declaration_date" | "politician_name"
export type SortDirection = "asc" | "desc"

export interface DeclarationPageRow {
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
  party_acronym: string | null
  party_color: string | null
  type: string | null
  total_count: number | null
}

export interface DeclarationPageResult {
  rows: DeclarationPageRow[]
  total: number
  parties: Array<{ acronym: string; color: string | null }>
}

interface RawDeclarationRow {
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
  party_acronym: string | null
  party_color: string | null
  type: string | null
  total_count: number | null
}

const getDeclarationsPageCached = unstable_cache(
  async (
    page: number,
    type?: DeclarationType | null,
    party?: string | null,
    search?: string | null,
    sort: DeclarationSortField = "declared_income",
    direction: SortDirection = "desc"
  ): Promise<DeclarationPageResult> => {
    const pageSize = PAGE_SIZE.declarations

    const { data, error } = await supabase.rpc("get_declarations_page", {
      p_type: type ?? null,
      p_party: party ?? null,
      p_search: search ?? null,
      p_sort: sort,
      p_direction: direction,
      p_page: page,
      p_page_size: pageSize,
    }).abortSignal(dataQuerySignal())

    if (error) {
      console.error("getDeclarationsPage error:", dataErrorMessage(error))
      throw new Error("Declarations data unavailable")
    }

    const raw = (data ?? []) as RawDeclarationRow[]
    const total = raw[0]?.total_count ?? 0

    const rows: DeclarationPageRow[] = raw.map(r => ({
      id: r.id,
      politician_id: r.politician_id,
      politician_name: r.politician_name,
      declaration_date: r.declaration_date,
      source_url: r.source_url,
      declared_income: r.declared_income,
      irpf_paid: r.irpf_paid,
      inmuebles_mentioned: r.inmuebles_mentioned,
      vehiculos_mentioned: r.vehiculos_mentioned,
      financial_assets_mentioned: r.financial_assets_mentioned,
      ocr_status: r.ocr_status,
      party_acronym: r.party_acronym,
      party_color: r.party_color,
      type: r.type,
      total_count: r.total_count,
    }))

    const partySet = new Map<string, string | null>()
    for (const row of raw) {
      if (row.party_acronym) {
        partySet.set(row.party_acronym, row.party_color ?? null)
      }
    }
    const parties = Array.from(partySet.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([acronym, color]) => ({ acronym, color }))

    return { rows, total, parties }
  },
  ["declarations-page-v2"],
  { revalidate: HOUR }
)

export async function getDeclarationsPage(
  page: number,
  type?: DeclarationType | null,
  party?: string | null,
  search?: string | null,
  sort: DeclarationSortField = "declared_income",
  direction: SortDirection = "desc"
): Promise<DeclarationPageResult> {
  return getDeclarationsPageCached(page, type, party, search, sort, direction)
}

export function parseDeclarationSort(
  sort?: string | string[],
  direction?: string | string[]
): { sort: DeclarationSortField; direction: SortDirection } {
  const rawSort = Array.isArray(sort) ? sort[0] : sort
  const rawDir = Array.isArray(direction) ? direction[0] : direction

  const validSorts: DeclarationSortField[] = ["declared_income", "declaration_date", "politician_name"]
  const sortVal = validSorts.includes(rawSort as DeclarationSortField)
    ? (rawSort as DeclarationSortField)
    : "declared_income"

  const dirVal = rawDir === "asc" ? "asc" : "desc"

  return { sort: sortVal, direction: dirVal }
}

export interface DeclarationDetailRow {
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
  party_acronym: string | null
  party_color: string | null
  type: string | null
  raw_data: Record<string, unknown> | null
}

const getDeclarationByIdCached = unstable_cache(
  async (id: string): Promise<DeclarationDetailRow | null> => {
    const { data, error } = await supabase
      .from("economic_declarations")
      .select(`
        id,
        politician_id,
        declaration_date,
        source_url,
        raw_data,
        politician:politicians(full_name)
      `)
      .eq("id", id)
      .abortSignal(dataQuerySignal())
      .single()

    if (error) {
      console.error("getDeclarationById error:", dataErrorMessage(error))
      return null
    }

    const pol = data.politician as { full_name: string | null } | { full_name: string | null }[] | null
    const name = Array.isArray(pol) ? pol[0]?.full_name ?? null : pol?.full_name ?? null

    const raw = (data.raw_data ?? {}) as Record<string, unknown>

    return {
      id: data.id,
      politician_id: data.politician_id,
      politician_name: name,
      declaration_date: data.declaration_date,
      source_url: data.source_url,
      declared_income: typeof raw.total_income === "number" ? raw.total_income : null,
      irpf_paid: typeof raw.irpf_paid === "number" ? raw.irpf_paid : null,
      inmuebles_mentioned: typeof raw.inmuebles_mentioned === "number" ? raw.inmuebles_mentioned : null,
      vehiculos_mentioned: typeof raw.vehiculos_mentioned === "number" ? raw.vehiculos_mentioned : null,
      financial_assets_mentioned: typeof raw.financial_assets_mentioned === "number" ? raw.financial_assets_mentioned : null,
      ocr_status: (raw.ocr_status as string | undefined) ?? null,
      party_acronym: null,
      party_color: null,
      type: (raw.type as string | undefined) ?? null,
      raw_data: raw,
    }
  },
  ["declaration-detail"],
  { revalidate: HOUR }
)

export async function getDeclarationById(id: string): Promise<DeclarationDetailRow | null> {
  try {
    return await getDeclarationByIdCached(id)
  } catch {
    return null
  }
}

// ── Per-deputy aggregated declarations ────────────────────────────────────────

export interface PoliticianDeclarationActivity {
  type: string | null
  period: string | null
  employer: string | null
  sector: string | null
  description: string | null
  declaration: string | null
}

export interface PoliticianDeclarationDoc {
  id: string
  type: string | null
  declaration_date: string | null
  /** "congreso_opendata" for structured registry data, otherwise OCR-derived. */
  source: string | null
  source_url: string | null
  total_income: number | null
  irpf_paid: number | null
  inmuebles: number | null
  vehiculos: number | null
  financial_assets: number | null
  incomes: Array<{ source: string; amount: number }>
  activities: PoliticianDeclarationActivity[]
  ocr_text: string | null
  ocr_status: string | null
}

export interface PoliticianDeclarationsResult {
  politician: {
    id: string
    full_name: string | null
    photo_url: string | null
    photo_variants: Record<string, string> | null
    party_acronym: string | null
    party_color: string | null
    party_id: string | null
    group_parliamentary: string | null
    chamber: string | null
  }
  docs: PoliticianDeclarationDoc[]
}

function toNum(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toInt(value: unknown): number | null {
  const n = toNum(value)
  return n == null ? null : Math.trunc(n)
}

const getPoliticianDeclarationsCached = unstable_cache(
  async (id: string): Promise<PoliticianDeclarationsResult | null> => {
    const { data, error } = await supabase
      .from("politicians")
      .select(
        `id, full_name, photo_url, photo_variants,
         politician_memberships(group_parliamentary, chamber, party:parties(id, acronym, color), legislature:legislatures(is_active)),
         economic_declarations(id, declaration_date, source_url, raw_data)`
      )
      .eq("id", id)
      .abortSignal(dataQuerySignal())
      .single()

    if (error) {
      console.error("getPoliticianDeclarations error:", dataErrorMessage(error))
      return null
    }
    if (!data) return null

    type MembershipRow = {
      group_parliamentary: string | null
      chamber: string | null
      party: { id: string; acronym: string | null; color: string | null } | { id: string; acronym: string | null; color: string | null }[] | null
      legislature: { is_active: boolean | null } | { is_active: boolean | null }[] | null
    }
    const memberships = (data.politician_memberships ?? []) as MembershipRow[]
    const isActive = (m: MembershipRow) => {
      const leg = Array.isArray(m.legislature) ? m.legislature[0] : m.legislature
      return leg?.is_active === true
    }
    const active = memberships.find(isActive) ?? memberships[0] ?? null
    const activeParty = active
      ? (Array.isArray(active.party) ? active.party[0] : active.party) ?? null
      : null

    type DeclRow = {
      id: string
      declaration_date: string | null
      source_url: string | null
      raw_data: Record<string, unknown> | null
    }
    const rawDecls = (data.economic_declarations ?? []) as DeclRow[]

    const docs: PoliticianDeclarationDoc[] = rawDecls.map((d) => {
      const raw = (d.raw_data ?? {}) as Record<string, unknown>
      const incomesRaw = Array.isArray(raw.incomes) ? (raw.incomes as Array<Record<string, unknown>>) : []
      const incomes = incomesRaw
        .map((inc) => ({ source: String(inc.source ?? ""), amount: toNum(inc.amount) ?? 0 }))
        .filter((inc) => inc.amount > 0)
      const activitiesRaw = Array.isArray(raw.activities) ? (raw.activities as Array<Record<string, unknown>>) : []
      const activities: PoliticianDeclarationActivity[] = activitiesRaw.map((a) => ({
        type: a.type != null ? String(a.type) : null,
        period: a.period != null ? String(a.period) : null,
        employer: a.employer != null ? String(a.employer) : null,
        sector: a.sector != null ? String(a.sector) : null,
        description: a.description != null ? String(a.description) : null,
        declaration: a.declaration != null ? String(a.declaration) : null,
      }))
      return {
        id: d.id,
        type: raw.type != null ? String(raw.type) : null,
        declaration_date: d.declaration_date,
        source: raw.source != null ? String(raw.source) : null,
        source_url: d.source_url,
        total_income: toNum(raw.total_income),
        irpf_paid: toNum(raw.irpf_paid),
        inmuebles: toInt(raw.inmuebles_mentioned),
        vehiculos: toInt(raw.vehiculos_mentioned),
        financial_assets: toInt(raw.financial_assets_mentioned),
        incomes,
        activities,
        ocr_text: raw.ocr_text != null ? String(raw.ocr_text) : null,
        ocr_status: raw.ocr_status != null ? String(raw.ocr_status) : null,
      }
    })

    // Newest first within the same type.
    docs.sort((a, b) => (b.declaration_date ?? "").localeCompare(a.declaration_date ?? ""))

    return {
      politician: {
        id: data.id,
        full_name: data.full_name ?? null,
        photo_url: data.photo_url ?? null,
        photo_variants: (data.photo_variants as Record<string, string> | null) ?? null,
        party_acronym: activeParty?.acronym ?? null,
        party_color: activeParty?.color ?? null,
        party_id: activeParty?.id ?? null,
        group_parliamentary: active?.group_parliamentary ?? null,
        chamber: active?.chamber ?? null,
      },
      docs,
    }
  },
  ["politician-declarations-v1"],
  { revalidate: HOUR }
)

export async function getPoliticianDeclarations(id: string): Promise<PoliticianDeclarationsResult | null> {
  try {
    return await getPoliticianDeclarationsCached(id)
  } catch {
    return null
  }
}

export { PAGE_SIZE }
