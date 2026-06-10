/**
 * Pure grouping logic for the /indicadores surface ("lo importante primero,
 * lo fancy plegado"):
 *
 *   destacado      → represented by the hero chain charts (salario real,
 *                    deuda); their cards only appear via search.
 *   principal      → visible card grid (PIB, paro… and any future code,
 *                    so new ETL series never disappear silently).
 *   ipc-subgrupos  → the 13 COICOP subgroup cards, folded.
 *   ipc-avanzado   → monthly index and month-over-month variations, folded.
 */

export type IndicatorGroup = "destacado" | "principal" | "ipc-subgrupos" | "ipc-avanzado"

const DESTACADO_CODES = new Set(["SALARIO_MEDIO", "DEUDA_PUBLICA"])

const IPC_AVANZADO_CODES = new Set(["IPC", "IPC_VAR_MENSUAL", "IPC_VAR_ANUAL"])

const IPC_SUBGRUPO_CODES = new Set([
  "IPC_ALIMENTOS",
  "IPC_BEBIDAS_TABACO",
  "IPC_VESTIDO",
  "IPC_VIVIENDA",
  "IPC_HOGAR",
  "IPC_SANIDAD",
  "IPC_TRANSPORTE",
  "IPC_COMUNICACIONES",
  "IPC_OCIO",
  "IPC_ENSENANZA",
  "IPC_RESTAURANTES",
  "IPC_SEGUROS",
  "IPC_DIVERSOS",
])

export function classifyIndicator(code: string): IndicatorGroup {
  if (DESTACADO_CODES.has(code)) return "destacado"
  if (IPC_AVANZADO_CODES.has(code)) return "ipc-avanzado"
  if (IPC_SUBGRUPO_CODES.has(code)) return "ipc-subgrupos"
  return "principal"
}

export interface GroupedIndicators<T> {
  principal: T[]
  destacado: T[]
  ipcSubgrupos: T[]
  ipcAvanzado: T[]
}

export function groupIndicators<T extends { code: string }>(
  items: T[]
): GroupedIndicators<T> {
  const groups: GroupedIndicators<T> = {
    principal: [],
    destacado: [],
    ipcSubgrupos: [],
    ipcAvanzado: [],
  }

  for (const item of items) {
    switch (classifyIndicator(item.code)) {
      case "destacado":
        groups.destacado.push(item)
        break
      case "ipc-subgrupos":
        groups.ipcSubgrupos.push(item)
        break
      case "ipc-avanzado":
        groups.ipcAvanzado.push(item)
        break
      default:
        groups.principal.push(item)
    }
  }

  return groups
}
