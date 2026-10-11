export const COFOG_FUNCTIONS = {
  GF01: {
    label: "Servicios públicos generales",
    detail:
      "Administración general, relaciones exteriores y otras actividades generales; incluye intereses de la deuda.",
  },
  GF02: {
    label: "Defensa",
    detail:
      "Defensa militar y civil, ayuda militar e investigación relacionada.",
  },
  GF03: {
    label: "Orden público y seguridad",
    detail: "Policía, protección contra incendios, tribunales y prisiones.",
  },
  GF04: {
    label: "Asuntos económicos",
    detail:
      "Actividad económica, transporte, agricultura, energía y otras políticas económicas.",
  },
  GF05: {
    label: "Protección del medio ambiente",
    detail:
      "Residuos, aguas residuales, contaminación y protección de la biodiversidad.",
  },
  GF06: {
    label: "Vivienda y servicios comunitarios",
    detail:
      "Desarrollo de vivienda y comunidades, abastecimiento de agua y alumbrado público.",
  },
  GF07: {
    label: "Salud",
    detail:
      "Servicios sanitarios, hospitales, productos médicos y salud pública.",
  },
  GF08: {
    label: "Ocio, cultura y religión",
    detail:
      "Servicios recreativos, deportivos, culturales y otras actividades de esta función.",
  },
  GF09: {
    label: "Educación",
    detail: "Enseñanza, servicios auxiliares y otras actividades educativas.",
  },
  GF10: {
    label: "Protección social",
    detail:
      "Vejez, enfermedad e incapacidad, familias, desempleo y otras prestaciones; no son solo pensiones.",
  },
} as const
export type CofogCode = keyof typeof COFOG_FUNCTIONS
export const COFOG_SOURCE =
  "https://ec.europa.eu/eurostat/databrowser/view/gov_10a_exp/default/table?lang=es"
export const COFOG_TOLERANCE = 0.6
export interface CofogObservation {
  geo: string
  sector: string
  year: number
  function_code: string
  value: number | string | null
  unit: string
  raw_data: Record<string, unknown> | null
}
export interface CofogYear {
  year: number
  total: number
  values: Record<CofogCode, number>
  provisional: boolean
  lastChecked: string | null
  residual: number
}

export function cofogYears(rows: CofogObservation[]) {
  const grouped = new Map<number, CofogObservation[]>()
  for (const row of rows) {
    const group = grouped.get(row.year) ?? []
    group.push(row)
    grouped.set(row.year, group)
  }
  const years: CofogYear[] = [],
    rejectedYears: number[] = []
  const codes = ["TOTAL", ...Object.keys(COFOG_FUNCTIONS)]
  for (const [year, group] of grouped) {
    const values = new Map<string, number>()
    const invalid =
      !Number.isInteger(year) ||
      year < 2016 ||
      year > 2100 ||
      group.length !== codes.length ||
      group.some((row) => {
        const meta = row.raw_data,
          value = Number(row.value)
        if (
          row.geo !== "ES" ||
          row.sector !== "S13" ||
          row.unit !== "MIO_EUR" ||
          !codes.includes(row.function_code) ||
          row.value == null ||
          row.value === "" ||
          !Number.isFinite(value) ||
          value < 0 ||
          values.has(row.function_code) ||
          meta?.dataset !== "gov_10a_exp" ||
          meta?.na_item !== "TE" ||
          meta?.frequency !== "A" ||
          meta?.mapping_version !== "cofog-level1-v1" ||
          meta?.accounts_total == null ||
          !Number.isFinite(Number(meta.accounts_total))
        )
          return true
        values.set(row.function_code, value)
        return false
      })
    const total = values.get("TOTAL") ?? NaN
    const residual =
      Object.keys(COFOG_FUNCTIONS).reduce(
        (sum, code) => sum + (values.get(code) ?? NaN),
        0,
      ) - total
    if (
      invalid ||
      !Number.isFinite(residual) ||
      Math.abs(residual) > COFOG_TOLERANCE ||
      group.some(
        (row) =>
          Math.abs(Number(row.raw_data?.accounts_total) - total) >
          COFOG_TOLERANCE,
      )
    ) {
      rejectedYears.push(year)
      continue
    }
    const checked = group
      .map((row) => row.raw_data?.retrieved_at)
      .filter((v): v is string => typeof v === "string")
      .sort()
    years.push({
      year,
      total,
      residual,
      values: Object.fromEntries(
        Object.keys(COFOG_FUNCTIONS).map((code) => [code, values.get(code)!]),
      ) as Record<CofogCode, number>,
      provisional: group.some((row) =>
        [row.raw_data?.flags, row.raw_data?.accounts_flags].some(
          (flags) =>
            Array.isArray(flags) && flags.some((f) => String(f).includes("p")),
        ),
      ),
      lastChecked: checked.length === group.length ? checked[0] : null,
    })
  }
  return {
    years: years.sort((a, b) => a.year - b.year),
    rejectedYears: rejectedYears.sort((a, b) => a - b),
  }
}

export function selectCofogYear(
  years: CofogYear[],
  requested?: string | string[],
) {
  return requested === undefined
    ? years.at(-1)
    : typeof requested === "string" && /^\d{4}$/.test(requested)
      ? years.find((y) => y.year === Number(requested))
      : undefined
}
