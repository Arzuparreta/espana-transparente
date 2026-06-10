import { describe, expect, it } from "vitest"

import { classifyIndicator, groupIndicators } from "./indicator-groups"

const EXPECTED: Record<string, ReturnType<typeof classifyIndicator>> = {
  PIB: "principal",
  PIB_VAR_ANUAL: "principal",
  TASA_PARO: "principal",
  PARADOS: "principal",
  SALARIO_MEDIO: "destacado",
  DEUDA_PUBLICA: "destacado",
  IPC: "ipc-avanzado",
  IPC_VAR_MENSUAL: "ipc-avanzado",
  IPC_VAR_ANUAL: "ipc-avanzado",
  IPC_ALIMENTOS: "ipc-subgrupos",
  IPC_BEBIDAS_TABACO: "ipc-subgrupos",
  IPC_VESTIDO: "ipc-subgrupos",
  IPC_VIVIENDA: "ipc-subgrupos",
  IPC_HOGAR: "ipc-subgrupos",
  IPC_SANIDAD: "ipc-subgrupos",
  IPC_TRANSPORTE: "ipc-subgrupos",
  IPC_COMUNICACIONES: "ipc-subgrupos",
  IPC_OCIO: "ipc-subgrupos",
  IPC_ENSENANZA: "ipc-subgrupos",
  IPC_RESTAURANTES: "ipc-subgrupos",
  IPC_SEGUROS: "ipc-subgrupos",
  IPC_DIVERSOS: "ipc-subgrupos",
}

describe("classifyIndicator", () => {
  it("maps every known indicator code to its group", () => {
    for (const [code, group] of Object.entries(EXPECTED)) {
      expect(classifyIndicator(code), code).toBe(group)
    }
  })

  it("defaults unknown codes to principal so future series stay visible", () => {
    expect(classifyIndicator("INGRESOS_PUBLICOS")).toBe("principal")
  })
})

describe("groupIndicators", () => {
  it("partitions completely while preserving input order", () => {
    const items = Object.keys(EXPECTED).map((code) => ({ code }))
    const groups = groupIndicators(items)

    const total =
      groups.principal.length +
      groups.destacado.length +
      groups.ipcSubgrupos.length +
      groups.ipcAvanzado.length
    expect(total).toBe(items.length)

    expect(groups.principal.map((i) => i.code)).toEqual([
      "PIB",
      "PIB_VAR_ANUAL",
      "TASA_PARO",
      "PARADOS",
    ])
    expect(groups.ipcSubgrupos).toHaveLength(13)
    expect(groups.ipcAvanzado.map((i) => i.code)).toEqual([
      "IPC",
      "IPC_VAR_MENSUAL",
      "IPC_VAR_ANUAL",
    ])
  })
})
