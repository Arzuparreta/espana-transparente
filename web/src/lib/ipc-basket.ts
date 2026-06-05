/**
 * Personalized inflation basket calculator.
 *
 * Uses IPC subgroup index series (base 2025=100) to compute the accumulated
 * inflation of a user-defined weighted basket vs the official general IPC.
 */

export interface SubgroupSeries {
  code: string
  name: string
  points: Array<{ period: string; value: number }>
}

export type Weights = Record<string, number>

/** INE official basket weights (approximate, COICOP 2018) for Spain.
 *  Used as the default when the user hasn't customized. Values sum to 100.
 */
export const DEFAULT_BASKET_WEIGHTS: Record<string, number> = {
  IPC_ALIMENTOS: 16.5,
  IPC_BEBIDAS_TABACO: 3.0,
  IPC_VESTIDO: 5.5,
  IPC_VIVIENDA: 14.0,
  IPC_HOGAR: 6.0,
  IPC_SANIDAD: 3.5,
  IPC_TRANSPORTE: 12.0,
  IPC_COMUNICACIONES: 4.0,
  IPC_OCIO: 9.0,
  IPC_ENSENANZA: 1.5,
  IPC_RESTAURANTES: 12.5,
  IPC_SEGUROS: 2.0,
  IPC_DIVERSOS: 10.5,
}

const SUBGROUP_CODES = Object.keys(DEFAULT_BASKET_WEIGHTS)

function findIndexForPeriod(points: Array<{ period: string; value: number }>, targetPeriod: string): number | null {
  const exact = points.find((p) => p.period === targetPeriod)
  if (exact) return exact.value
  // Fallback: find first point in the target year
  const yearPrefix = targetPeriod.slice(0, 4)
  const yearPoints = points.filter((p) => p.period.startsWith(yearPrefix))
  if (yearPoints.length > 0) return yearPoints[0].value
  return null
}

function findLatestPoint(points: Array<{ period: string; value: number }>): { period: string; value: number } | null {
  if (points.length === 0) return null
  return points[points.length - 1]
}

export interface BasketResult {
  referencePeriod: string
  latestPeriod: string
  basketInflation: number
  generalInflation: number
  gap: number
  subgroupResults: Array<{
    code: string
    name: string
    weight: number
    referenceValue: number
    latestValue: number
    inflation: number
  }>
}

/**
 * Compute personalized basket inflation.
 *
 * @param series — all subgroup series fetched from DB
 * @param weights — user-defined weights (0-100 per subgroup). Will be normalized to sum 100.
 * @param referenceYear — year to compare against (e.g. "2023")
 */
export function computeBasketInflation(
  series: SubgroupSeries[],
  weights: Weights,
  referenceYear: string
): BasketResult | null {
  const referencePeriod = `${referenceYear}-01`
  const byCode = new Map(series.map((s) => [s.code, s]))

  const generalSeries = byCode.get("IPC")
  if (!generalSeries) return null

  const latestGeneral = findLatestPoint(generalSeries.points)
  if (!latestGeneral) return null

  const generalRef = findIndexForPeriod(generalSeries.points, referencePeriod)
  const generalLatest = latestGeneral.value
  if (generalRef == null) return null

  const generalInflation = (generalLatest / generalRef - 1) * 100

  // Normalize weights to sum 100
  const totalWeight = SUBGROUP_CODES.reduce((sum, code) => sum + (weights[code] ?? 0), 0)
  const normalizer = totalWeight > 0 ? 100 / totalWeight : 1

  let basketInflation = 0
  const subgroupResults = []

  for (const code of SUBGROUP_CODES) {
    const subgroup = byCode.get(code)
    const weight = (weights[code] ?? 0) * normalizer
    if (!subgroup || weight === 0) {
      subgroupResults.push({
        code,
        name: subgroup?.name ?? code,
        weight,
        referenceValue: 0,
        latestValue: 0,
        inflation: 0,
      })
      continue
    }

    const refValue = findIndexForPeriod(subgroup.points, referencePeriod)
    const latestPoint = findLatestPoint(subgroup.points)
    if (refValue == null || latestPoint == null) {
      subgroupResults.push({
        code,
        name: subgroup.name,
        weight,
        referenceValue: 0,
        latestValue: 0,
        inflation: 0,
      })
      continue
    }

    const inflation = (latestPoint.value / refValue - 1) * 100
    basketInflation += inflation * (weight / 100)
    subgroupResults.push({
      code,
      name: subgroup.name,
      weight,
      referenceValue: refValue,
      latestValue: latestPoint.value,
      inflation,
    })
  }

  return {
    referencePeriod,
    latestPeriod: latestGeneral.period,
    basketInflation,
    generalInflation,
    gap: basketInflation - generalInflation,
    subgroupResults,
  }
}

/**
 * Returns available year options from the series data.
 */
export function getAvailableYears(series: SubgroupSeries[]): string[] {
  const general = series.find((s) => s.code === "IPC")
  if (!general) return []
  const years = new Set<string>()
  for (const point of general.points) {
    years.add(point.period.slice(0, 4))
  }
  return Array.from(years).sort()
}
