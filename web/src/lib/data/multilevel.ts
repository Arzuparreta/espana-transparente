import { supabase } from "@/lib/supabase/client"
import { unstable_cache, HOUR, throwDataError } from "./shared"
import { CCAA_GEO, getCcaaByDbKey } from "@/lib/ccaa-geo-mapping"
import { normalizeTerritoryAlias } from "@/lib/territory-catalog"

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

function toNumber(value: unknown) {
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
  if (scope === "autonomic") {
    const atlas = await fetchTerritoryAtlas()
    const ccaa = atlas.territories.filter((territory) => territory.type === "ccaa")
    const territories: TerritoryMoneyRollup[] = ccaa
      .map((territory) => {
        const rows = atlas.spend.filter((row) => row.ccaaKey === territory.key)
        const subsidyRows = rows.filter((row) => row.dataset === "subsidies")
        const contractRows = rows.filter((row) => row.dataset === "contracts")
        return {
          territoryKey: territory.key,
          territoryName: territory.name,
          subsidyCount: subsidyRows.reduce((sum, row) => sum + row.recordCount, 0),
          subsidyAmount: subsidyRows.reduce((sum, row) => sum + row.totalAmount, 0),
          subsidyLatestDate:
            subsidyRows
              .map((row) => row.latestRecordDate)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1) ?? null,
          contractCount: contractRows.reduce((sum, row) => sum + row.recordCount, 0),
          contractAmount: contractRows.reduce((sum, row) => sum + row.totalAmount, 0),
          contractLatestDate:
            contractRows
              .map((row) => row.latestRecordDate)
              .filter((value): value is string => Boolean(value))
              .sort()
              .at(-1) ?? null,
        }
      })
      .sort(compareTerritories)
    const summary = territories.reduce<MultilevelSummary>(
      (acc, territory) => ({
        subsidyCount: acc.subsidyCount + territory.subsidyCount,
        subsidyLatestDate:
          [acc.subsidyLatestDate, territory.subsidyLatestDate]
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null,
        contractCount: acc.contractCount + territory.contractCount,
        contractLatestDate:
          [acc.contractLatestDate, territory.contractLatestDate]
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null,
      }),
      {
        subsidyCount: 0,
        subsidyLatestDate: null,
        contractCount: 0,
        contractLatestDate: null,
      }
    )
    return {
      summary,
      territories,
      coverage: atlas.coverage.map((row) => ({
        dataset: row.dataset,
        resolvedCount: row.resolvedRecords,
        unresolvedCount: row.unresolvedRecords,
      })),
    }
  }

  const [summary, rollupsRes, coverageRes] = await Promise.all([
    fetchMultilevelSummary("LOCAL", scope),
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
  if (scope === "autonomic") {
    const atlas = await fetchTerritoryAtlas()
    let territory = atlas.territories.find(
      (candidate) => candidate.type === "ccaa" && candidate.key === territoryKey
    )
    if (!territory) {
      const aliasResponse = await supabase
        .from("territory_aliases")
        .select("territory_key")
        .eq("alias_key", normalizeTerritoryAlias(territoryKey))
        .maybeSingle()
      throwDataError(aliasResponse.error, "autonomic territory alias")
      const aliasTerritory = atlas.territories.find(
        (candidate) => candidate.key === aliasResponse.data?.territory_key
      )
      territory =
        aliasTerritory?.type === "ccaa"
          ? aliasTerritory
          : atlas.territories.find(
              (candidate) =>
                candidate.type === "ccaa" && candidate.key === aliasTerritory?.parentKey
            )
    }
    if (!territory) return null
    const canonicalKey = territory.key
    const rows = atlas.spend.filter((row) => row.ccaaKey === canonicalKey)
    const subsidyRows = rows.filter((row) => row.dataset === "subsidies")
    const contractRows = rows.filter((row) => row.dataset === "contracts")
    const [subsidiesRes, contractsRes] = await Promise.all([
      supabase
        .from("subsidies")
        .select("id, nivel2, beneficiario, convocatoria, importe, fecha_concesion, source_url, nivel3")
        .eq("ccaa_key", canonicalKey)
        .order("fecha_concesion", { ascending: false, nullsFirst: false })
        .limit(8),
      supabase
        .from("contracts")
        .select("id, region, title, awarding_body, amount, date, source_url, contract_type")
        .eq("ccaa_key", canonicalKey)
        .order("date", { ascending: false, nullsFirst: false })
        .limit(8),
    ])
    throwDataError(subsidiesRes.error, "autonomic territory subsidies")
    throwDataError(contractsRes.error, "autonomic territory contracts")
    return {
      territory: {
        territoryKey: canonicalKey,
        territoryName: territory.name,
        subsidyCount: subsidyRows.reduce((sum, row) => sum + row.recordCount, 0),
        subsidyAmount: subsidyRows.reduce((sum, row) => sum + row.totalAmount, 0),
        subsidyLatestDate:
          subsidyRows
            .map((row) => row.latestRecordDate)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null,
        contractCount: contractRows.reduce((sum, row) => sum + row.recordCount, 0),
        contractAmount: contractRows.reduce((sum, row) => sum + row.totalAmount, 0),
        contractLatestDate:
          contractRows
            .map((row) => row.latestRecordDate)
            .filter((value): value is string => Boolean(value))
            .sort()
            .at(-1) ?? null,
      },
      recentSubsidies: (subsidiesRes.data ?? []).map((row) => ({
        id: String(row.id),
        territoryName: String(row.nivel2 ?? territory.name),
        beneficiario: (row.beneficiario as string | null) ?? null,
        convocatoria: (row.convocatoria as string | null) ?? null,
        importe: toNumber(row.importe),
        fechaConcesion: (row.fecha_concesion as string | null) ?? null,
        sourceUrl: (row.source_url as string | null) ?? null,
        grantingBody: (row.nivel3 as string | null) ?? null,
      })),
      recentContracts: (contractsRes.data ?? []).map((row) => ({
        id: String(row.id),
        territoryName: String(row.region ?? territory.name),
        title: (row.title as string | null) ?? null,
        awardingBody: (row.awarding_body as string | null) ?? null,
        amount: toNumber(row.amount),
        date: (row.date as string | null) ?? null,
        sourceUrl: (row.source_url as string | null) ?? null,
        contractType: (row.contract_type as string | null) ?? null,
      })),
    }
  }

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
  if (scope === "autonomic") {
    const atlas = await fetchTerritoryAtlas()
    return atlas.territories
      .filter((territory) => territory.type === "ccaa")
      .map((territory) => ({ territoryKey: territory.key }))
  }

  const response = await supabase
    .from("v_territory_money_rollups")
    .select("territory_key")
    .eq("administration_level", scope)

  return (response.data ?? [])
    .map((row) => ({ territoryKey: String(row.territory_key) }))
    .filter((row) => row.territoryKey.length > 0)
}

// Scope-parameterized boundary (autonomic | municipal). One cached path per
// concern instead of duplicated autonomic/municipal wrappers — `unstable_cache`
// keys on the arguments, so each scope is memoized independently.
export const getTerritoryLanding = unstable_cache(
  (scope: TerritoryScope) => fetchTerritoryLanding(scope),
  ["multilevel-territory-landing"],
  { revalidate: HOUR }
)

export const getTerritoryDetail = unstable_cache(
  (scope: TerritoryScope, territoryKey: string) => fetchTerritoryDetail(scope, territoryKey),
  ["multilevel-territory-detail"],
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

export const getTerritoryKeys = unstable_cache(
  (scope: TerritoryScope) => fetchTerritoryKeys(scope),
  ["multilevel-territory-keys"],
  { revalidate: HOUR }
)

export type AtlasTerritory = {
  key: string
  name: string
  type: "ccaa" | "province"
  parentKey: string | null
  nutsCode: string | null
  sortOrder: number
}

export type AtlasSpendRow = {
  dataset: "contracts" | "subsidies"
  year: number
  ccaaKey: string
  provinceKey: string | null
  recordCount: number
  totalAmount: number
  latestRecordDate: string | null
}

export type AtlasPopulationRow = {
  territoryKey: string
  year: number
  population: number
}

export type AtlasCoverageRow = {
  dataset: "contracts" | "subsidies"
  totalRecords: number
  resolvedRecords: number
  unresolvedRecords: number
}

export type TerritoryAtlasData = {
  territories: AtlasTerritory[]
  spend: AtlasSpendRow[]
  population: AtlasPopulationRow[]
  coverage: AtlasCoverageRow[]
  years: number[]
}

async function fetchPagedTable(
  table: string,
  columns: string,
  pageSize = 1000
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += pageSize) {
    const response = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
    throwDataError(response.error, table)
    rows.push(...((response.data ?? []) as unknown as Record<string, unknown>[]))
    if ((response.data?.length ?? 0) < pageSize) break
  }
  return rows
}

async function fetchTerritoryAtlas(): Promise<TerritoryAtlasData> {
  const [territoryRows, spendRows, populationRows, coverageResponse] = await Promise.all([
    fetchPagedTable(
      "territory_catalog",
      "territory_key, territory_name, territory_type, parent_key, nuts_code, sort_order"
    ),
    fetchPagedTable(
      "v_territory_spend_yearly",
      "dataset, year, ccaa_key, province_key, record_count, total_amount, latest_record_date"
    ),
    fetchPagedTable("territory_population", "territory_key, year, population"),
    supabase
      .from("v_territory_spend_coverage")
      .select("dataset, total_records, resolved_records, unresolved_records"),
  ])
  throwDataError(coverageResponse.error, "territory atlas coverage")

  const spend: AtlasSpendRow[] = spendRows.map((row) => ({
    dataset: row.dataset as AtlasSpendRow["dataset"],
    year: toNumber(row.year),
    ccaaKey: String(row.ccaa_key),
    provinceKey: row.province_key ? String(row.province_key) : null,
    recordCount: toNumber(row.record_count),
    totalAmount: toNumber(row.total_amount),
    latestRecordDate: (row.latest_record_date as string | null) ?? null,
  }))

  return {
    territories: territoryRows.map((row) => ({
      key: String(row.territory_key),
      name: String(row.territory_name),
      type: row.territory_type as AtlasTerritory["type"],
      parentKey: row.parent_key ? String(row.parent_key) : null,
      nutsCode: row.nuts_code ? String(row.nuts_code) : null,
      sortOrder: toNumber(row.sort_order),
    })),
    spend,
    population: populationRows.map((row) => ({
      territoryKey: String(row.territory_key),
      year: toNumber(row.year),
      population: toNumber(row.population),
    })),
    coverage: (coverageResponse.data ?? []).map((row) => ({
      dataset: row.dataset as AtlasCoverageRow["dataset"],
      totalRecords: toNumber(row.total_records),
      resolvedRecords: toNumber(row.resolved_records),
      unresolvedRecords: toNumber(row.unresolved_records),
    })),
    years: Array.from(new Set(spend.map((row) => row.year))).sort((a, b) => b - a),
  }
}

export const getTerritoryAtlas = unstable_cache(
  fetchTerritoryAtlas,
  ["territory-atlas-v1"],
  { revalidate: HOUR }
)
