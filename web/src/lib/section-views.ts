export const DEPUTY_VIEWS = ["directorio", "asistencia", "divergencias"] as const
export type DeputyView = (typeof DEPUTY_VIEWS)[number]

export const MONEY_VIEWS = ["resumen", "trazabilidad"] as const
export type MoneyView = (typeof MONEY_VIEWS)[number]

export const ECONOMY_VIEWS = ["resumen", "series", "calculadoras"] as const
export type EconomyView = (typeof ECONOMY_VIEWS)[number]

export function parseView<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate && allowed.includes(candidate as T) ? (candidate as T) : fallback
}

