import type { SpainMapCcaa } from "@/lib/data/multilevel"

export type { SpainMapCcaa }

export type MapLayer = "ccaa" | "provinces"

export type SelectedCcaa = {
  topoKey: string
  displayName: string
  flagKey: string
  subsidyTotal: number
  contractTotal: number
  subsidyCount: number
  contractCount: number
  totalAmount: number
}
