export const SECTORS = {
  S13: {
    label: "Conjunto de administraciones",
    detail:
      "Agregado consolidado: elimina las operaciones internas correspondientes. No se añade a los subsectores.",
  },
  S1311: {
    label: "Administración central",
    detail:
      "Administración central y unidades clasificadas en este subsector SEC 2010; no equivale solo a los ministerios.",
  },
  S1312: {
    label: "Administraciones autonómicas",
    detail:
      "Conjunto del subsector autonómico español, no las cuentas de una comunidad concreta.",
  },
  S1313: {
    label: "Administraciones locales",
    detail:
      "Conjunto del subsector local; no solo ayuntamientos ni el presupuesto de tu municipio.",
  },
  S1314: {
    label: "Fondos de la Seguridad Social",
    detail:
      "Subsector de Seguridad Social según SEC 2010; no equivale solo a pensiones ni a todo el gasto sanitario.",
  },
} as const
export type Sector = keyof typeof SECTORS
export const SECTOR_SOURCE =
  "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_main/default/table?lang=es"
export const SECTOR_ITEMS = ["TR", "TE", "B9"] as const
export interface SectorObservation {
  geo: string
  sector: string
  year: number
  item: string
  value: number | string | null
  unit: string
  raw_data: Record<string, unknown> | null
}
export interface SectorYear {
  year: number
  values: Record<Sector, Record<(typeof SECTOR_ITEMS)[number], number>>
  provisional: boolean
  lastChecked: string | null
}
export function sectorYears(rows: SectorObservation[]) {
  const groups = new Map<number, SectorObservation[]>()
  for (const row of rows)
    groups.set(row.year, [...(groups.get(row.year) ?? []), row])
  const years: SectorYear[] = [],
    rejectedYears: number[] = []
  for (const [year, group] of groups) {
    const values = Object.fromEntries(
      Object.keys(SECTORS).map((s) => [s, {}]),
    ) as SectorYear["values"]
    const seen = new Set<string>()
    const invalid =
      !Number.isInteger(year) ||
      year < 2016 ||
      year > 2100 ||
      group.length !== 15 ||
      group.some((r) => {
        const key = `${r.sector}/${r.item}`,
          value = Number(r.value),
          meta = r.raw_data
        if (
          !Object.hasOwn(SECTORS, r.sector) ||
          !SECTOR_ITEMS.includes(r.item as "TR") ||
          seen.has(key) ||
          r.geo !== "ES" ||
          r.unit !== "MIO_EUR" ||
          r.value == null ||
          (typeof r.value !== "number" && typeof r.value !== "string") ||
          (typeof r.value === "string" && !r.value.trim()) ||
          !Number.isFinite(value) ||
          (r.item !== "B9" && value < 0) ||
          meta?.dataset !== "gov_10a_main" ||
          meta?.frequency !== "A" ||
          meta?.unit !== "MIO_EUR" ||
          meta?.mapping_version !== "esa-sectors-v1"
        )
          return true
        seen.add(key)
        values[r.sector as Sector][r.item as "TR"] = value
        return false
      })
    if (
      invalid ||
      Object.values(values).some(
        (v) =>
          !Number.isFinite(v.TR - v.TE - v.B9) ||
          Math.abs(v.TR - v.TE - v.B9) > 0.3,
      ) ||
      Math.abs(
        values.S1311.B9 +
          values.S1312.B9 +
          values.S1313.B9 +
          values.S1314.B9 -
          values.S13.B9,
      ) > 0.6
    ) {
      rejectedYears.push(year)
      continue
    }
    const checked = group
      .map((r) => r.raw_data?.retrieved_at)
      .filter(
        (v): v is string =>
          typeof v === "string" && Number.isFinite(Date.parse(v)),
      )
      .sort()
    years.push({
      year,
      values,
      lastChecked: checked.length === group.length ? checked[0] : null,
      provisional: group.some(
        (r) =>
          Array.isArray(r.raw_data?.flags) &&
          r.raw_data.flags.some((f) => String(f).includes("p")),
      ),
    })
  }
  return {
    years: years.sort((a, b) => a.year - b.year),
    rejectedYears: rejectedYears.sort((a, b) => a - b),
  }
}
export function selectSectorYear(
  years: SectorYear[],
  requested?: string | string[],
) {
  return requested === undefined
    ? years.at(-1)
    : typeof requested === "string" && /^\d{4}$/.test(requested)
      ? years.find((y) => y.year === Number(requested))
      : undefined
}
