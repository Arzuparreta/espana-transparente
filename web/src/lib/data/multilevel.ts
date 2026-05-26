import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR } from "./shared"
import { CCAA_GEO, getCcaaByDbKey } from "@/lib/ccaa-geo-mapping"

export type TerritoryScope = "autonomic" | "municipal"

export type MultilevelSummary = {
  subsidyCount: number
  subsidyLatestDate: string | null
  contractCount: number
  contractLatestDate: string | null
}

export type TerritoryMoneyRollup = {
  territoryKey: string
  territoryName: string
  subsidyCount: number
  subsidyAmount: number
  subsidyLatestDate: string | null
  contractCount: number
  contractAmount: number
  contractLatestDate: string | null
}

export type TerritoryCoverageRow = {
  dataset: "subsidies" | "contracts"
  resolvedCount: number
  unresolvedCount: number
}

export type TerritoryLandingData = {
  summary: MultilevelSummary
  territories: TerritoryMoneyRollup[]
  coverage: TerritoryCoverageRow[]
}

export type TerritoryRecentSubsidy = {
  id: string
  territoryName: string
  beneficiario: string | null
  convocatoria: string | null
  importe: number
  fechaConcesion: string | null
  sourceUrl: string | null
  grantingBody: string | null
}

export type TerritoryRecentContract = {
  id: string
  territoryName: string
  title: string | null
  awardingBody: string | null
  amount: number
  date: string | null
  sourceUrl: string | null
  contractType: string | null
}

export type TerritoryDetailData = {
  territory: TerritoryMoneyRollup
  recentSubsidies: TerritoryRecentSubsidy[]
  recentContracts: TerritoryRecentContract[]
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function compareTerritories(a: TerritoryMoneyRollup, b: TerritoryMoneyRollup) {
  const aRecords = a.subsidyCount + a.contractCount
  const bRecords = b.subsidyCount + b.contractCount
  if (bRecords !== aRecords) return bRecords - aRecords

  const aAmount = a.subsidyAmount + a.contractAmount
  const bAmount = b.subsidyAmount + b.contractAmount
  if (bAmount !== aAmount) return bAmount - aAmount

  return a.territoryName.localeCompare(b.territoryName, "es")
}

async function fetchMultilevelSummary(
  subsidyNivel1: string,
  contractLevel: string
): Promise<MultilevelSummary> {
  const [subsidyCountRes, subsidyLatestRes, contractCountRes, contractLatestRes] =
    await Promise.all([
      supabase
        .from("subsidies")
        .select("id", { count: "exact", head: true })
        .eq("nivel1", subsidyNivel1),
      supabase
        .from("subsidies")
        .select("fecha_concesion")
        .eq("nivel1", subsidyNivel1)
        .order("fecha_concesion", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("administration_level", contractLevel),
      supabase
        .from("contracts")
        .select("date")
        .eq("administration_level", contractLevel)
        .order("date", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
    ])

  return {
    subsidyCount: subsidyCountRes.count ?? 0,
    subsidyLatestDate: (subsidyLatestRes.data?.fecha_concesion as string | null) ?? null,
    contractCount: contractCountRes.count ?? 0,
    contractLatestDate: (contractLatestRes.data?.date as string | null) ?? null,
  }
}

async function fetchTerritoryLanding(scope: TerritoryScope): Promise<TerritoryLandingData> {
  const subsidyNivel1 = scope === "autonomic" ? "AUTONOMICA" : "LOCAL"
  const [summary, rollupsRes, coverageRes] = await Promise.all([
    fetchMultilevelSummary(subsidyNivel1, scope),
    supabase
      .from("v_territory_money_rollups")
      .select(
        "territory_key, territory_name, subsidy_count, subsidy_amount, subsidy_latest_date, contract_count, contract_amount, contract_latest_date"
      )
      .eq("administration_level", scope),
    supabase
      .from("v_territory_money_coverage")
      .select("dataset, resolved_count, unresolved_count")
      .eq("administration_level", scope),
  ])

  const territories: TerritoryMoneyRollup[] = (rollupsRes.data ?? [])
    .map((row) => ({
      territoryKey: String(row.territory_key),
      territoryName: String(row.territory_name),
      subsidyCount: toNumber(row.subsidy_count),
      subsidyAmount: toNumber(row.subsidy_amount),
      subsidyLatestDate: (row.subsidy_latest_date as string | null) ?? null,
      contractCount: toNumber(row.contract_count),
      contractAmount: toNumber(row.contract_amount),
      contractLatestDate: (row.contract_latest_date as string | null) ?? null,
    }))
    .sort(compareTerritories)

  const coverage: TerritoryCoverageRow[] = (coverageRes.data ?? []).map((row) => ({
    dataset: row.dataset as "subsidies" | "contracts",
    resolvedCount: toNumber(row.resolved_count),
    unresolvedCount: toNumber(row.unresolved_count),
  }))

  return { summary, territories, coverage }
}

async function fetchTerritoryDetail(scope: TerritoryScope, territoryKey: string): Promise<TerritoryDetailData | null> {
  const [territoryRes, subsidiesRes, contractsRes] = await Promise.all([
    supabase
      .from("v_territory_money_rollups")
      .select(
        "territory_key, territory_name, subsidy_count, subsidy_amount, subsidy_latest_date, contract_count, contract_amount, contract_latest_date"
      )
      .eq("administration_level", scope)
      .eq("territory_key", territoryKey)
      .maybeSingle(),
    supabase
      .from("v_subsidy_territory_records")
      .select("id, territory_name, beneficiario, convocatoria, importe, fecha_concesion, source_url, granting_body")
      .eq("administration_level", scope)
      .eq("territory_key", territoryKey)
      .order("fecha_concesion", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("v_contract_territory_records")
      .select("id, territory_name, title, awarding_body, amount, date, source_url, contract_type")
      .eq("administration_level", scope)
      .eq("territory_key", territoryKey)
      .order("date", { ascending: false, nullsFirst: false })
      .limit(8),
  ])

  if (!territoryRes.data) return null

  return {
    territory: {
      territoryKey: String(territoryRes.data.territory_key),
      territoryName: String(territoryRes.data.territory_name),
      subsidyCount: toNumber(territoryRes.data.subsidy_count),
      subsidyAmount: toNumber(territoryRes.data.subsidy_amount),
      subsidyLatestDate: (territoryRes.data.subsidy_latest_date as string | null) ?? null,
      contractCount: toNumber(territoryRes.data.contract_count),
      contractAmount: toNumber(territoryRes.data.contract_amount),
      contractLatestDate: (territoryRes.data.contract_latest_date as string | null) ?? null,
    },
    recentSubsidies: (subsidiesRes.data ?? []).map((row) => ({
      id: String(row.id),
      territoryName: String(row.territory_name),
      beneficiario: (row.beneficiario as string | null) ?? null,
      convocatoria: (row.convocatoria as string | null) ?? null,
      importe: toNumber(row.importe),
      fechaConcesion: (row.fecha_concesion as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      grantingBody: (row.granting_body as string | null) ?? null,
    })),
    recentContracts: (contractsRes.data ?? []).map((row) => ({
      id: String(row.id),
      territoryName: String(row.territory_name),
      title: (row.title as string | null) ?? null,
      awardingBody: (row.awarding_body as string | null) ?? null,
      amount: toNumber(row.amount),
      date: (row.date as string | null) ?? null,
      sourceUrl: (row.source_url as string | null) ?? null,
      contractType: (row.contract_type as string | null) ?? null,
    })),
  }
}

async function fetchTerritoryKeys(scope: TerritoryScope) {
  const response = await supabase
    .from("v_territory_money_rollups")
    .select("territory_key")
    .eq("administration_level", scope)

  return (response.data ?? [])
    .map((row) => ({ territoryKey: String(row.territory_key) }))
    .filter((row) => row.territoryKey.length > 0)
}

export const getAutonomicSummary = unstable_cache(
  () => fetchMultilevelSummary("AUTONOMICA", "autonomic"),
  ["multilevel-autonomic-summary"],
  { revalidate: HOUR }
)

export const getMunicipalSummary = unstable_cache(
  () => fetchMultilevelSummary("LOCAL", "municipal"),
  ["multilevel-municipal-summary"],
  { revalidate: HOUR }
)

export const getAutonomicLanding = unstable_cache(
  () => fetchTerritoryLanding("autonomic"),
  ["multilevel-autonomic-landing"],
  { revalidate: HOUR }
)

export const getMunicipalLanding = unstable_cache(
  () => fetchTerritoryLanding("municipal"),
  ["multilevel-municipal-landing"],
  { revalidate: HOUR }
)

export const getAutonomicTerritoryDetail = unstable_cache(
  (territoryKey: string) => fetchTerritoryDetail("autonomic", territoryKey),
  ["multilevel-autonomic-detail"],
  { revalidate: HOUR }
)

export const getMunicipalTerritoryDetail = unstable_cache(
  (territoryKey: string) => fetchTerritoryDetail("municipal", territoryKey),
  ["multilevel-municipal-detail"],
  { revalidate: HOUR }
)

export type SpainMapCcaa = {
  topoKey: string
  routeKey: string
  displayName: string
  flagKey: string
  subsidyTotal: number
  contractTotal: number
  subsidyCount: number
  contractCount: number
  totalAmount: number
}

async function fetchSpainMapData(): Promise<SpainMapCcaa[]> {
  const { data } = await supabase
    .from("v_territory_money_rollups")
    .select("territory_key, subsidy_count, subsidy_amount, contract_count, contract_amount")
    .eq("administration_level", "autonomic")

  const spendByTopoKey = new Map<string, { routeKey: string; sc: number; sa: number; cc: number; ca: number }>()

  for (const row of data ?? []) {
    const territoryKey = String(row.territory_key)
    const entry = getCcaaByDbKey(territoryKey)
    if (!entry) continue
    const prev = spendByTopoKey.get(entry.topoKey) ?? { routeKey: territoryKey, sc: 0, sa: 0, cc: 0, ca: 0 }
    spendByTopoKey.set(entry.topoKey, {
      routeKey: prev.routeKey,
      sc: prev.sc + toNumber(row.subsidy_count),
      sa: prev.sa + toNumber(row.subsidy_amount),
      cc: prev.cc + toNumber(row.contract_count),
      ca: prev.ca + toNumber(row.contract_amount),
    })
  }

  return CCAA_GEO.map((entry) => {
    const d = spendByTopoKey.get(entry.topoKey) ?? { routeKey: entry.dbKeys[0], sc: 0, sa: 0, cc: 0, ca: 0 }
    return {
      topoKey: entry.topoKey,
      routeKey: d.routeKey,
      displayName: entry.displayName,
      flagKey: entry.flagKey,
      subsidyCount: d.sc,
      subsidyTotal: d.sa,
      contractCount: d.cc,
      contractTotal: d.ca,
      totalAmount: d.sa + d.ca,
    }
  })
}

export const getSpainMapData = unstable_cache(
  fetchSpainMapData,
  ["spain-map-data"],
  { revalidate: HOUR }
)

export const getAutonomicTerritoryKeys = unstable_cache(
  () => fetchTerritoryKeys("autonomic"),
  ["multilevel-autonomic-keys"],
  { revalidate: HOUR }
)

export const getMunicipalTerritoryKeys = unstable_cache(
  () => fetchTerritoryKeys("municipal"),
  ["multilevel-municipal-keys"],
  { revalidate: HOUR }
)
