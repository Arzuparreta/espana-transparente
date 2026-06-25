"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"

export type PickerTerritory = {
  key: string
  name: string
  type: "ccaa" | "province"
  parentKey: string | null
}

/**
 * Cascading territory selector with explicit destinations. Selecting a CCAA or
 * a province only updates local state — the visitor chooses *where* to go via
 * one of the two CTAs. This avoids the previous "auto-navigate on the first
 * change" trap that prevented picking a province after a CCAA.
 */
export function TerritoryPicker({ territories }: { territories: PickerTerritory[] }) {
  const router = useRouter()
  const [ccaa, setCcaa] = useState("")
  const [province, setProvince] = useState("")

  const ccaaList = useMemo(
    () =>
      territories
        .filter((t) => t.type === "ccaa")
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [territories]
  )
  const provinceList = useMemo(
    () =>
      territories
        .filter((t) => t.type === "province" && t.parentKey === ccaa)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [territories, ccaa]
  )

  const selectedCcaa = ccaaList.find((t) => t.key === ccaa)
  const selectedProvince = provinceList.find((t) => t.key === province)

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Comunidad autónoma
          </span>
          <select
            value={ccaa}
            onChange={(e) => {
              setCcaa(e.target.value)
              setProvince("")
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
            onChange={(e) => setProvince(e.target.value)}
            className="rounded-[2px] border border-border bg-card px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {ccaa ? "Todas las provincias" : "Elige comunidad primero"}
            </option>
            {provinceList.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!ccaa}
          onClick={() =>
            router.push(`/territorio/ccaa/${encodeURIComponent(ccaa)}`)
          }
        >
          {selectedCcaa ? `Ver ${selectedCcaa.name}` : "Ver comunidad"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!province}
          onClick={() =>
            router.push(
              `/contratos?flow=to&province=${encodeURIComponent(province)}`
            )
          }
        >
          {selectedProvince
            ? `Ver empresas en ${selectedProvince.name}`
            : "Ver empresas en la provincia"}
        </Button>
        <Link
          href="/territorio"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          o abre el mapa completo →
        </Link>
      </div>
    </div>
  )
}
