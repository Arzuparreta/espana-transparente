import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PHOTOS_CACHE_VERSION, type TopContractAncla, type TopDivergenceSessionAncla, type InflationAnchor } from "./shared"
import { getIndicatorSectionFacts } from "./conexiones"
import { getCriticalPipelineStatuses, type EtlPipelineRow } from "@/lib/etl-pipelines"

export type { TopContractAncla, TopDivergenceSessionAncla, InflationAnchor }

export type SectionIndexRow = {
  section_key: string
  record_count: number | null
  latest_date: string | null
}

export type HomeHeroAnchor =
  | {
      kind: "deuda"
      label: string
      value: string
      resolver: string
      source: string
      href: string
      hrefLabel: string
    }
  | {
      kind: "contract"
      label: string
      value: string
      resolver: string
      resolverDetail: string | null
      source: string
      href: string
      hrefLabel: string
    }
  | {
      kind: "ipc"
      label: string
      value: string
      resolver: string
      source: string
      href: string
      hrefLabel: string
    }

export type EtlFreshness = {
  status: "fresh" | "delayed" | "unavailable"
  latestFinishedAt: string | null
  pipelineCount: number
  delayedPipelines: string[]
}

function applySectionOverrides(rows: SectionIndexRow[], overrides: SectionIndexRow[]): SectionIndexRow[] {
  const byKey = new Map(rows.map((row) => [row.section_key, row]))
  for (const override of overrides) {
    byKey.set(override.section_key, override)
  }
  return Array.from(byKey.values())
}

// Reads from section_index_cache table (populated by ETL, refreshed daily).
// Falls back to get_section_index() RPC if cache is empty (first deploy).
// Indicator previews use the same live table as /indicadores to avoid stale
// section_index_cache values disagreeing with the visible series dashboard.
export const getSectionIndex = unstable_cache(
  async (): Promise<SectionIndexRow[]> => {
    const indicatorFacts = await getIndicatorSectionFacts()
    const { data, error } = await supabase
      .from("section_index_cache")
      .select("section_key, record_count, latest_date")
    if (!error && data && data.length > 0) {
      const rows = (data as SectionIndexRow[]).map((row) => ({
        section_key: row.section_key,
        record_count: row.record_count != null ? Number(row.record_count) : null,
        latest_date: row.latest_date ?? null,
      }))
      // Sanity check: if every single count is 0 the cache was likely
      // seeded before any data existed. Fall back to live RPC counts.
      const hasAnyCount = rows.some((r) => (r.record_count ?? 0) > 0)
      if (hasAnyCount) {
        return applySectionOverrides(rows, [indicatorFacts])
      }
    }
    // Fallback to RPC (will be slower but correct)
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_section_index")
    if (rpcError || !rpcData) return []
    const rows = (rpcData as SectionIndexRow[]).map((row) => ({
      section_key: row.section_key,
      record_count: row.record_count != null ? Number(row.record_count) : null,
      latest_date: row.latest_date ?? null,
    }))
    return applySectionOverrides(rows, [indicatorFacts])
  },
  ["section-index"],
  { revalidate: HOUR }
)

export const getHomeData = unstable_cache(
  async () => {
    const [
      parties,
      revolvingDoorCases,
      gobierno,
      deudaPublica,
    ] = await Promise.all([
      supabase.from("parties").select("acronym, color, name").order("acronym"),
      supabase
        .from("v_revolving_door_public")
        .select("id, person_name, public_role, private_organization, sector, person_id")
        .order("id", { ascending: false })
        .limit(4),
      supabase
        .from("v_gobierno_actual")
        .select("id, person_name, organization_name, political_party, party_color, politician_id, position_type")
        .in("position_type", ["presidente_gobierno", "vicepresidente"])
        .limit(6),
      supabase
        .from("economic_indicators")
        .select("period, value, unit")
        .eq("indicator_code", "DEUDA_PUBLICA")
        .order("period", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const deudaRow = deudaPublica.data
    const POBLACION_ESPANA = 47_400_000
    const deudaPerCapita =
      deudaRow?.value != null
        ? Math.round((deudaRow.value as number) * 1_000_000 / POBLACION_ESPANA)
        : null
    const deudaYear = deudaRow?.period ? String(deudaRow.period).slice(0, 4) : null

    return {
      parties: parties.data ?? [],
      revolvingDoorCases: revolvingDoorCases.data ?? [],
      gobierno: gobierno.data ?? [],
      deudaPerCapita,
      deudaYear,
    }
  },
  ["home-data", PHOTOS_CACHE_VERSION],
  { revalidate: 4 * HOUR }
)

export const getTopContractOfMonth = unstable_cache(
  async (): Promise<TopContractAncla | null> => {
    const windows: Array<30 | 60 | 90> = [30, 60, 90]
    for (const days of windows) {
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from("contracts")
        .select("id, title, amount, awarding_body, contractor, date")
        .gte("date", from)
        .order("amount", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (data) return { ...(data as Omit<TopContractAncla, "windowDays">), windowDays: days }
    }
    const { data } = await supabase
      .from("contracts")
      .select("id, title, amount, awarding_body, contractor, date")
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    return data ? { ...(data as Omit<TopContractAncla, "windowDays">), windowDays: null } : null
  },
  ["top-contract-of-month"],
  { revalidate: HOUR }
)

export const getTopDivergenceSessionOfMonth = unstable_cache(
  async (): Promise<TopDivergenceSessionAncla | null> => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const recent = await supabase
      .from("v_voting_session_summary")
      .select("id, title, date, divergence_count")
      .gte("date", thirtyDaysAgo)
      .gt("divergence_count", 0)
      .order("divergence_count", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent.data) {
      return { ...(recent.data as Omit<TopDivergenceSessionAncla, "isRecent">), isRecent: true }
    }
    const allTime = await supabase
      .from("v_voting_session_summary")
      .select("id, title, date, divergence_count")
      .gt("divergence_count", 0)
      .order("divergence_count", { ascending: false })
      .limit(1)
      .maybeSingle()
    return allTime.data
      ? { ...(allTime.data as Omit<TopDivergenceSessionAncla, "isRecent">), isRecent: false }
      : null
  },
  ["top-divergence-session-of-month"],
  { revalidate: HOUR }
)

// Picks the strongest available headline data point. Tried in order:
// 1. Deuda pública per cápita (Eurostat) — most consequential macro stat
// 2. Largest contract in the last 30/60/90 days (current event signal)
// 3. Latest monthly IPC (always present)
// Returns null only when none of the three is available — a degenerate state.
export async function getHomeHeroAnchor(
  deudaPerCapita: number | null,
  deudaYear: string | null,
  topContract: TopContractAncla | null,
  inflation: InflationAnchor | null
): Promise<HomeHeroAnchor | null> {
  if (deudaPerCapita != null) {
    return {
      kind: "deuda",
      label: `Deuda pública por ciudadano${deudaYear ? ` · ${deudaYear}` : ""}`,
      value: `${deudaPerCapita.toLocaleString("es-ES")} €`,
      resolver:
        "Por cada persona en España, esto es lo que debe el Estado: deuda pública total dividida entre la población.",
      source: "Fuente: Eurostat (criterio de Maastricht).",
      href: "/economia?view=series",
      hrefLabel: "Ver indicadores →",
    }
  }
  if (topContract?.amount != null) {
    const amountStr = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(topContract.amount)
    const window =
      topContract.windowDays === 30
        ? "últimos 30 días"
        : topContract.windowDays === 60
          ? "últimos 60 días"
          : topContract.windowDays === 90
            ? "últimos 90 días"
            : "histórico"
    return {
      kind: "contract",
      label: `Mayor contrato · ${window}`,
      value: amountStr,
      resolver: topContract.title,
      resolverDetail: topContract.awarding_body,
      source: "Fuente: Plataforma de Contratación del Sector Público.",
      href: `/contratos/${topContract.id}`,
      hrefLabel: "Ver contrato →",
    }
  }
  if (inflation) {
    const sign = inflation.monthlyValue > 0 ? "+" : ""
    const value = `${sign}${inflation.monthlyValue.toLocaleString("es-ES", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`
    const [year, month] = inflation.period.split("-")
    const periodLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    })
    return {
      kind: "ipc",
      label: `IPC mensual · ${periodLabel}`,
      value,
      resolver: "Variación mensual del índice general de precios.",
      source: "Fuente: INE, serie nacional del IPC.",
      href: "/indicadores/IPC_VAR_MENSUAL",
      hrefLabel: "Ver serie →",
    }
  }
  return null
}

// One-line freshness signal. Counts pipelines that have ever completed and
// returns the most recent successful finish across all of them. Renders in the
// header strip on the home: "DATOS ACTUALIZADOS · 21 MAY 2026 · 14 FUENTES".
export const getEtlFreshnessSummary = unstable_cache(
  async (): Promise<EtlFreshness> => {
    const { data, error } = await supabase
      .from("v_etl_pipeline_status")
      .select("pipeline, last_finished_at, last_status")
    if (error) {
      return {
        status: "unavailable",
        latestFinishedAt: null,
        pipelineCount: 0,
        delayedPipelines: [],
      }
    }

    const rows = (data ?? []) as EtlPipelineRow[]
    const finished = rows
      .filter((r) => r.last_status === "succeeded" && r.last_finished_at != null)
      .map((r) => r.last_finished_at as string)
      .sort()
    const criticalStatuses = getCriticalPipelineStatuses(rows)
    const delayedPipelines = criticalStatuses
      .filter((row) => row.status !== "fresh")
      .map((row) => row.label)

    return {
      status: delayedPipelines.length > 0 ? "delayed" : "fresh",
      latestFinishedAt: finished.at(-1) ?? null,
      pipelineCount: rows.length,
      delayedPipelines,
    }
  },
  ["etl-freshness-summary-v2"],
  { revalidate: HOUR }
)

export const getLatestInflationAnchor = unstable_cache(
  async (): Promise<InflationAnchor | null> => {
    const monthly = await supabase
      .from("economic_indicators")
      .select("period, value, raw_data")
      .eq("indicator_code", "IPC_VAR_MENSUAL")
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (monthly.data?.value == null || monthly.data.period == null) return null

    const annual = await supabase
      .from("economic_indicators")
      .select("period, value")
      .eq("indicator_code", "IPC_VAR_ANUAL")
      .eq("period", monthly.data.period as string)
      .limit(1)
      .maybeSingle()

    const rawData = monthly.data.raw_data as { point?: { T3_TipoDato?: string | null } } | null | undefined

    return {
      period: monthly.data.period as string,
      monthlyValue: Number(monthly.data.value),
      annualValue: annual.data?.value != null ? Number(annual.data.value) : null,
      dataType: rawData?.point?.T3_TipoDato ?? null,
    }
  },
  ["latest-inflation-anchor"],
  { revalidate: HOUR }
)
