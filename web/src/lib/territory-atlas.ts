import type {
  AtlasPopulationRow,
  AtlasSpendRow,
  AtlasTerritory,
} from "@/lib/data/multilevel"
import type {
  TerritoryDataset,
  TerritoryMetric,
} from "@/lib/territory-catalog"

export type TerritoryValue = {
  key: string
  name: string
  parentKey: string | null
  amount: number
  records: number
  population: number | null
  perCapita: number | null
  latestRecordDate: string | null
}

function populationForYear(
  rows: AtlasPopulationRow[],
  territoryKey: string,
  year: number
) {
  return rows
    .filter((row) => row.territoryKey === territoryKey && row.year <= year)
    .sort((a, b) => b.year - a.year)[0]?.population ?? null
}

export function aggregateTerritoryValues({
  territories,
  spend,
  population,
  dataset,
  year,
  parentKey = null,
}: {
  territories: AtlasTerritory[]
  spend: AtlasSpendRow[]
  population: AtlasPopulationRow[]
  dataset: TerritoryDataset
  year: number | "all"
  parentKey?: string | null
}): TerritoryValue[] {
  const targetType = parentKey ? "province" : "ccaa"
  const targets = territories.filter(
    (territory) =>
      territory.type === targetType &&
      (parentKey ? territory.parentKey === parentKey : true)
  )

  return targets.map((territory) => {
    const rows = spend.filter((row) => {
      const rowKey = parentKey ? row.provinceKey : row.ccaaKey
      return (
        rowKey === territory.key &&
        (dataset === "all" || row.dataset === dataset) &&
        (year === "all" || row.year === year)
      )
    })
    const amount = rows.reduce((sum, row) => sum + row.totalAmount, 0)
    const records = rows.reduce((sum, row) => sum + row.recordCount, 0)
    const latestRecordDate =
      rows
        .map((row) => row.latestRecordDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? null
    const populationValue =
      year === "all" || parentKey
        ? null
        : populationForYear(population, territory.key, year)

    return {
      key: territory.key,
      name: territory.name,
      parentKey: territory.parentKey,
      amount,
      records,
      population: populationValue,
      perCapita:
        populationValue && populationValue > 0 ? amount / populationValue : null,
      latestRecordDate,
    }
  })
}

export function metricValue(row: TerritoryValue, metric: TerritoryMetric) {
  if (metric === "records") return row.records
  if (metric === "per-capita") return row.perCapita ?? 0
  return row.amount
}

export function quantileThresholds(values: number[], buckets = 5) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
  if (sorted.length === 0) return []
  return Array.from({ length: buckets - 1 }, (_, index) => {
    const position = Math.ceil(((index + 1) / buckets) * sorted.length) - 1
    return sorted[Math.max(0, position)]
  })
}

export function quantileIndex(value: number, thresholds: number[]) {
  if (value <= 0) return -1
  if (
    thresholds.length > 0 &&
    thresholds.every((threshold) => threshold === thresholds[0]) &&
    value === thresholds[0]
  ) {
    return thresholds.length
  }
  return thresholds.findIndex((threshold) => value <= threshold) === -1
    ? thresholds.length
    : thresholds.findIndex((threshold) => value <= threshold)
}

export function latestCompleteYear(years: number[], currentYear: number) {
  return years.find((year) => year < currentYear) ?? years[0] ?? currentYear
}
