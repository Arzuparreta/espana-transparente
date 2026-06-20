"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

export type PickerTerritory = {
  key: string
  name: string
  type: "ccaa" | "province"
  parentKey: string | null
}

/**
 * Cascading territory selector for the hub: pick CCAA → (opcional) provincia.
 * Selecting a CCAA navigates to its dossier; picking a province deep-links to
 * the spending lists filtered to receptors located there (flow=to). Keeps the
 * hub usable for a visitor who arrives without knowing how to search.
 */
export function TerritoryPicker({ territories }: { territories: PickerTerritory[] }) {
  const router = useRouter()
  const [ccaa, setCcaa] = useState("")
  const [province, setProvince] = useState("")

  const ccaaList = useMemo(
    () => territories.filter((t) => t.type === "ccaa").sort((a, b) => a.name.localeCompare(b.name, "es")),
    [territories]
  )
  const provinceList = useMemo(
    () =>
      territories
        .filter((t) => t.type === "province" && t.parentKey === ccaa)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [territories, ccaa]
  )

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Comunidad autónoma
        </span>
        <select
          value={ccaa}
          onChange={(e) => {
            const next = e.target.value
            setCcaa(next)
            setProvince("")
            if (next) router.push(`/territorio/ccaa/${encodeURIComponent(next)}`)
          }}
          className="rounded-[2px] border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="">Elige tu comunidad…</option>
          {ccaaList.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Provincia (empresas de aquí)
        </span>
        <select
          value={province}
          disabled={!ccaa}
          onChange={(e) => {
            const next = e.target.value
            setProvince(next)
            if (next) router.push(`/contratos?flow=to&province=${encodeURIComponent(next)}`)
          }}
          className="rounded-[2px] border border-border bg-card px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">{ccaa ? "Todas las provincias" : "Elige comunidad primero"}</option>
          {provinceList.map((t) => (
            <option key={t.key} value={t.key}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
