import { CHAPTERS, type Chapter, executionRatio } from "./budget-execution";
export { CHAPTERS, executionRatio };
export const LIQUIDATION_SOURCE =
  "https://serviciostelematicosext.hacienda.gob.es/SGCIEF/PublicacionLiquidaciones/aspx/menuInicio.aspx";
export const REGIONS = {
  ANDALUCIA: {
    name: "Andalucía",
    code: "01",
  },
  ARAGON: {
    name: "Aragón",
    code: "02",
  },
  ASTURIAS: {
    name: "Asturias",
    code: "03",
  },
  ILLES_BALEARS: {
    name: "Illes Balears",
    code: "04",
  },
  CANARIAS: {
    name: "Canarias",
    code: "05",
  },
  CANTABRIA: {
    name: "Cantabria",
    code: "06",
  },
  CASTILLA_Y_LEON: {
    name: "Castilla y León",
    code: "07",
  },
  CASTILLA_LA_MANCHA: {
    name: "Castilla-La Mancha",
    code: "08",
  },
  CATALUNYA: {
    name: "Cataluña",
    code: "09",
  },
  EXTREMADURA: {
    name: "Extremadura",
    code: "10",
  },
  GALICIA: {
    name: "Galicia",
    code: "11",
  },
  MADRID: {
    name: "Madrid",
    code: "12",
  },
  MURCIA: {
    name: "Murcia",
    code: "13",
  },
  NAVARRA: {
    name: "Navarra",
    code: "14",
  },
  PAIS_VASCO: {
    name: "País Vasco",
    code: "15",
  },
  LA_RIOJA: {
    name: "La Rioja",
    code: "16",
  },
  COMUNITAT_VALENCIANA: {
    name: "Comunitat Valenciana",
    code: "17",
  },
} as const;
export type Region = keyof typeof REGIONS;
export const FIELDS = ["initial", "credit", "obligations", "payments"] as const;
export type Values = Record<(typeof FIELDS)[number], number | null>;
export interface Observation {
  territory: string;
  year: number;
  chapter: string;
  initial: number | string | null;
  credit: number | string | null;
  obligations: number | string | null;
  payments: number | string | null;
  unit: string;
  raw_data: Record<string, unknown> | null;
}
export interface Liquidation {
  territory: Region;
  rows: Record<Chapter, Values>;
  sourceUrl: string;
  lastChecked: string | null;
}
export function liquidationData(observations: Observation[]) {
  const regions: Liquidation[] = [],
    rejected: string[] = [];
  for (const key of Object.keys(REGIONS) as Region[]) {
    const group = observations.filter((r) => r.territory === key),
      rows = {} as Record<Chapter, Values>;
    const sourceUrl = `https://serviciostelematicosext.hacienda.gob.es/SGCIEF/PublicacionLiquidaciones/aspx/DescargaEconomicaDC.aspx?cdcdad=${REGIONS[key].code}&ano=2024`;
    const hashes = new Set(group.map((r) => r.raw_data?.workbook_sha256));
    const valid =
      group.length === 12 &&
      hashes.size === 1 &&
      group.every((r) => {
        const m = r.raw_data;
        if (
          r.year !== 2024 ||
          r.unit !== "MILES_EUR" ||
          !Object.hasOwn(CHAPTERS, r.chapter) ||
          Object.hasOwn(rows, r.chapter) ||
          m?.source_url !== sourceUrl ||
          m?.year !== 2024 ||
          m?.hacienda_code !== REGIONS[key].code ||
          m?.perimeter !== "consolidated_budget" ||
          m?.status !== "definitive" ||
          m?.mapping_version !== "hacienda-liquidation-v1" ||
          m?.unit !== "MILES_EUR" ||
          typeof m?.workbook_sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(m.workbook_sha256)
        )
          return false;
        const values = {} as Values;
        for (const f of FIELDS) {
          const v = r[f];
          if (
            v !== null &&
            ((typeof v !== "number" && typeof v !== "string") ||
              (typeof v === "string" && !v.trim()) ||
              !Number.isFinite(Number(v)) ||
              Number(v) < 0)
          )
            return false;
          values[f] = v === null ? null : Number(v);
        }
        rows[r.chapter as Chapter] = values;
        return true;
      });
    const reconciled =
      valid &&
      (
        [
          ["NF", list("1234567")],
          ["FIN", list("89")],
          ["TOTAL", ["NF", "FIN"]],
        ] as [Chapter, Chapter[]][]
      ).every(([t, parts]) =>
        FIELDS.every(
          (f) =>
            rows[t][f] !== null &&
            Math.abs(
              parts.reduce((sum, c) => sum + (rows[c][f] ?? 0), 0) -
                rows[t][f]!,
            ) <= 0.051,
        ),
      );
    if (!reconciled) {
      rejected.push(key);
      continue;
    }
    const checked = group
      .map((r) => r.raw_data?.retrieved_at)
      .filter(
        (v): v is string =>
          typeof v === "string" && Number.isFinite(Date.parse(v)),
      )
      .sort();
    regions.push({
      territory: key,
      rows,
      sourceUrl,
      lastChecked: checked.length === 12 ? checked[0] : null,
    });
  }
  // A comparative surface needs all 17 administrations; never show a partial ranking.
  if (observations.some((r) => !Object.hasOwn(REGIONS, r.territory)))
    rejected.push("fuera de ámbito");
  return {
    regions: rejected.length
      ? []
      : regions.sort((a, b) =>
          REGIONS[a.territory].name.localeCompare(
            REGIONS[b.territory].name,
            "es",
          ),
        ),
    rejected,
  };
}
function list(s: string) {
  return [...s] as Chapter[];
}
export function selectLiquidation(
  regions: Liquidation[],
  year?: string | string[],
  territory?: string | string[],
) {
  if (year !== undefined && year !== "2024")
    return { available: false, selected: undefined };
  if (
    territory !== undefined &&
    territory !== "all" &&
    (typeof territory !== "string" || !Object.hasOwn(REGIONS, territory))
  )
    return { available: false, selected: undefined };
  return {
    available: regions.length === 17,
    selected:
      typeof territory === "string"
        ? regions.find((r) => r.territory === territory)
        : undefined,
  };
}
