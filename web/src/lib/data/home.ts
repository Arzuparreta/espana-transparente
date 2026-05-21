import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, PHOTOS_CACHE_VERSION, type TopContractAncla, type TopDivergenceSessionAncla, type InflationAnchor } from "./shared"

export type { TopContractAncla, TopDivergenceSessionAncla, InflationAnchor }

export type SectionIndexRow = {
  section_key: string
  record_count: number | null
  latest_date: string | null
}

export type SessionDivergenceExample = {
  full_name: string
  party_acronym: string | null
  party_color: string | null
  vote: "Sí" | "No" | "Abstención"
  party_majority: "Sí" | "No" | "Abstención" | null
  divergent_count: number
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
  latestFinishedAt: string | null
  pipelineCount: number
}

// One RPC, ~14 sections. Replaces the per-section count fanout the home would
// otherwise need for the Phase 1 "Qué hay aquí" map. Returns [] silently if the
// migration is not yet applied — the home falls back to label-only cards.
export const getSectionIndex = unstable_cache(
  async (): Promise<SectionIndexRow[]> => {
    const { data, error } = await supabase.rpc("get_section_index")
    if (error || !data) return []
    return (data as SectionIndexRow[]).map((row) => ({
      section_key: row.section_key,
      record_count: row.record_count != null ? Number(row.record_count) : null,
      latest_date: row.latest_date ?? null,
    }))
  },
  ["section-index"],
  { revalidate: HOUR }
)

export const getHomeData = unstable_cache(
  async () => {
    const currentBudgetYear = new Date().getFullYear()

    const [
      politicians,
      politicianCount,
      parties,
      contractCount,
      subsidyCount,
      budgetSummaryRows,
      recentSessions,
      sessionCount,
      revolvingDoorCases,
      gobierno,
      deudaPublica,
    ] = await Promise.all([
      supabase
        .from("politicians")
        .select(
          "id, first_name, last_name, full_name, photo_url, photo_variants, politician_memberships!inner(id, constituency, group_parliamentary, is_active, party:parties(id, acronym, color, name))"
        )
        .eq("politician_memberships.is_active", true)
        .eq("politician_memberships.chamber", "congress")
        .order("full_name")
        .limit(12),
      supabase
        .from("politician_memberships")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("chamber", "congress"),
      supabase.from("parties").select("acronym, color, name").order("acronym"),
      supabase.from("contracts").select("*", { count: "exact", head: true }),
      supabase.from("subsidies").select("*", { count: "exact", head: true }),
      supabase
        .from("v_budget_summary")
        .select("year, budget_type, total_credit_initial")
        .eq("year", currentBudgetYear),
      supabase
        .from("v_voting_session_summary")
        .select("id, date, title, total_votes, votes_yes, votes_no, divergence_count")
        .order("date", { ascending: false })
        .limit(5),
      supabase.from("voting_sessions").select("*", { count: "exact", head: true }),
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

    const budgetTotal = (budgetSummaryRows.data ?? []).reduce(
      (sum, r) => sum + ((r.total_credit_initial as number) ?? 0),
      0
    )
    const currentBudgetType =
      budgetSummaryRows.data?.[0]?.budget_type != null
        ? String(budgetSummaryRows.data[0].budget_type)
        : null

    const deudaRow = deudaPublica.data
    const POBLACION_ESPANA = 47_400_000
    const deudaPerCapita =
      deudaRow?.value != null
        ? Math.round((deudaRow.value as number) * 1_000_000 / POBLACION_ESPANA)
        : null
    const deudaYear = deudaRow?.period ? String(deudaRow.period).slice(0, 4) : null

    return {
      politicians: politicians.data ?? [],
      politicianCount: politicianCount.count ?? 0,
      parties: parties.data ?? [],
      contractCount: contractCount.count ?? 0,
      subsidyCount: subsidyCount.count ?? 0,
      sessionCount: sessionCount.count ?? 0,
      currentBudget:
        budgetTotal > 0
          ? { year: currentBudgetYear, total: budgetTotal, budgetType: currentBudgetType }
          : null,
      recentSessions: recentSessions.data ?? [],
      sessionDivergenceExamples: await fetchSessionDivergenceExamples(
        (recentSessions.data ?? [])
          .filter((s) => ((s.divergence_count as number | null) ?? 0) > 0)
          .map((s) => s.id as string)
      ),
      revolvingDoorCases: revolvingDoorCases.data ?? [],
      gobierno: gobierno.data ?? [],
      deudaPerCapita,
      deudaYear,
    }
  },
  ["home-data", PHOTOS_CACHE_VERSION],
  { revalidate: HOUR }
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

// For each session id, fetch one example diverging deputy (politician whose vote
// differs from the most-voted option among their party-mates in that session,
// excluding "No vota"). Returns a Map keyed by session id. Bounded queries: each
// session is ~350 rows. Caller passes only sessions known to have ≥1 divergence.
async function fetchSessionDivergenceExamples(
  sessionIds: string[]
): Promise<Record<string, SessionDivergenceExample>> {
  if (sessionIds.length === 0) return {}
  const results = await Promise.all(
    sessionIds.map(async (id) => {
      const { data } = await supabase
        .from("votes")
        .select(
          "vote, politician:politicians(full_name, politician_memberships(is_active, chamber, party:parties(acronym, color)))"
        )
        .eq("voting_session_id", id)
      if (!data || data.length === 0) return [id, null] as const
      type Row = {
        vote: string
        politician: {
          full_name: string
          politician_memberships: {
            is_active: boolean
            chamber: string
            party: { acronym: string | null; color: string | null } | null
          }[]
        } | null
      }
      const rows = (data as unknown as Row[]).map((r) => {
        const membership = r.politician?.politician_memberships?.find(
          (m) => m.is_active && m.chamber === "congress"
        )
        return {
          vote: r.vote,
          fullName: r.politician?.full_name ?? null,
          partyAcronym: membership?.party?.acronym ?? null,
          partyColor: membership?.party?.color ?? null,
        }
      })

      const tally: Record<string, Record<string, number>> = {}
      for (const row of rows) {
        if (!row.partyAcronym || row.vote === "No vota") continue
        if (!["Sí", "No", "Abstención"].includes(row.vote)) continue
        const inner = tally[row.partyAcronym] ?? {}
        inner[row.vote] = (inner[row.vote] ?? 0) + 1
        tally[row.partyAcronym] = inner
      }
      const partyMajority: Record<string, string> = {}
      for (const party of Object.keys(tally)) {
        const counts = tally[party]
        let best: [string, number] | null = null
        for (const vote of Object.keys(counts)) {
          const count = counts[vote]
          if (!best || count > best[1]) best = [vote, count]
        }
        if (best) partyMajority[party] = best[0]
      }

      const divergent: typeof rows = []
      for (const row of rows) {
        if (!row.partyAcronym || !row.fullName) continue
        if (row.vote === "No vota") continue
        if (!["Sí", "No", "Abstención"].includes(row.vote)) continue
        const majority = partyMajority[row.partyAcronym]
        if (majority && row.vote !== majority) divergent.push(row)
      }
      if (divergent.length === 0) return [id, null] as const

      divergent.sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "", "es"))
      const pick = divergent[0]
      const majority = pick.partyAcronym ? (partyMajority[pick.partyAcronym] ?? null) : null
      const example: SessionDivergenceExample = {
        full_name: pick.fullName ?? "",
        party_acronym: pick.partyAcronym,
        party_color: pick.partyColor,
        vote: pick.vote as SessionDivergenceExample["vote"],
        party_majority: (majority ?? null) as SessionDivergenceExample["party_majority"],
        divergent_count: divergent.length,
      }
      return [id, example] as const
    })
  )
  const out: Record<string, SessionDivergenceExample> = {}
  for (const [id, ex] of results) {
    if (ex) out[id] = ex
  }
  return out
}

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
      href: "/indicadores",
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
    const { data } = await supabase
      .from("v_etl_pipeline_status")
      .select("pipeline, last_finished_at, last_status")
    const rows = (data ?? []) as { pipeline: string; last_finished_at: string | null; last_status: string | null }[]
    const finished = rows
      .filter((r) => r.last_finished_at != null)
      .map((r) => r.last_finished_at as string)
      .sort()
    return {
      latestFinishedAt: finished.at(-1) ?? null,
      pipelineCount: rows.length,
    }
  },
  ["etl-freshness-summary"],
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
