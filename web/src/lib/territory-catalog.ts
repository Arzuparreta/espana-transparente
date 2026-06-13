export type TerritoryMetric = "amount" | "records" | "per-capita"
export type TerritoryDataset = "all" | "contracts" | "subsidies"

export const TERRITORY_DATASETS: TerritoryDataset[] = ["all", "contracts", "subsidies"]
export const TERRITORY_METRICS: TerritoryMetric[] = ["amount", "records", "per-capita"]

export const PROVINCE_TOPO_TO_KEY: Record<string, string> = {
  ALAVA: "ALAVA",
  ALBACETE: "ALBACETE",
  ALICANTE: "ALICANTE",
  ALMERIA: "ALMERIA",
  ASTURIAS: "ASTURIAS_PROVINCE",
  AVILA: "AVILA",
  BADAJOZ: "BADAJOZ",
  BALEARES: "ILLES_BALEARS_PROVINCE",
  BARCELONA: "BARCELONA",
  BIZKAIA: "BIZKAIA",
  BURGOS: "BURGOS",
  CACERES: "CACERES",
  CADIZ: "CADIZ",
  CANTABRIA: "CANTABRIA_PROVINCE",
  CASTELLON: "CASTELLON",
  CEUTA: "CEUTA_PROVINCE",
  CIUDAD_REAL: "CIUDAD_REAL",
  CORDOBA: "CORDOBA",
  CUENCA: "CUENCA",
  GERONA: "GIRONA",
  GIPUZKOA: "GIPUZKOA",
  GRANADA: "GRANADA",
  GUADALAJARA: "GUADALAJARA",
  HUELVA: "HUELVA",
  HUESCA: "HUESCA",
  JAEN: "JAEN",
  LAS_PALMAS: "LAS_PALMAS",
  LA_CORUNA: "A_CORUNA",
  LA_RIOJA: "LA_RIOJA_PROVINCE",
  LEON: "LEON",
  LERIDA: "LLEIDA",
  LUGO: "LUGO",
  MADRID: "MADRID_PROVINCE",
  MALAGA: "MALAGA",
  MELILLA: "MELILLA_PROVINCE",
  MURCIA: "MURCIA_PROVINCE",
  NAVARRA: "NAVARRA_PROVINCE",
  ORENSE: "OURENSE",
  PALENCIA: "PALENCIA",
  PONTEVEDRA: "PONTEVEDRA",
  SALAMANCA: "SALAMANCA",
  SANTA_CRUZ_DE_TENERIFE: "SANTA_CRUZ_DE_TENERIFE",
  SEGOVIA: "SEGOVIA",
  SEVILLA: "SEVILLA",
  SORIA: "SORIA",
  TARRAGONA: "TARRAGONA",
  TERUEL: "TERUEL",
  TOLEDO: "TOLEDO",
  VALENCIA: "VALENCIA",
  VALLADOLID: "VALLADOLID",
  ZAMORA: "ZAMORA",
  ZARAGOZA: "ZARAGOZA",
}

export const CCAA_TOPO_TO_KEY: Record<string, string> = {
  BALEARES: "ILLES_BALEARS",
  CASTILLA_LEON: "CASTILLA_Y_LEON",
  CATALUNA: "CATALUNYA",
}

export function getCanonicalCcaaKey(key: string): string {
  return CCAA_TOPO_TO_KEY[key] ?? key
}

export function normalizeTerritoryAlias(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function parseTerritoryDataset(value: string | string[] | undefined): TerritoryDataset {
  const candidate = Array.isArray(value) ? value[0] : value
  return TERRITORY_DATASETS.includes(candidate as TerritoryDataset)
    ? (candidate as TerritoryDataset)
    : "contracts"
}

export function parseTerritoryMetric(value: string | string[] | undefined): TerritoryMetric {
  const candidate = Array.isArray(value) ? value[0] : value
  return TERRITORY_METRICS.includes(candidate as TerritoryMetric)
    ? (candidate as TerritoryMetric)
    : "amount"
}
