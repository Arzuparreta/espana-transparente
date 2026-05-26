/**
 * Maps between DB territory keys, TopoJSON ccaa_key values, and display names.
 * The TopoJSON in /public/geo/spain.topo.json uses ccaa_key as the primary identifier.
 * The DB returns territory_key from v_territory_money_rollups (normalize_money_text output).
 */

export type CcaaGeoEntry = {
  /** Key used in spain.topo.json (ccaa_key property) */
  topoKey: string
  /** Canonical display name */
  displayName: string
  /** Key used in territory-flags.ts FLAGS_BY_KEY */
  flagKey: string
  /** All possible DB territory_key values that map to this CCAA */
  dbKeys: string[]
}

export const CCAA_GEO: CcaaGeoEntry[] = [
  {
    topoKey: "ANDALUCIA",
    displayName: "Andalucía",
    flagKey: "ANDALUCIA",
    dbKeys: ["ANDALUCIA"],
  },
  {
    topoKey: "ARAGON",
    displayName: "Aragón",
    flagKey: "ARAGON",
    dbKeys: ["ARAGON", "ARAGONESA"],
  },
  {
    topoKey: "ASTURIAS",
    displayName: "Asturias",
    flagKey: "ASTURIAS",
    dbKeys: ["ASTURIAS", "PRINCIPADO_DE_ASTURIAS"],
  },
  {
    topoKey: "BALEARES",
    displayName: "Illes Balears",
    flagKey: "ILLES_BALEARS",
    dbKeys: ["BALEARES", "ILLES_BALEARS", "ISLAS_BALEARES"],
  },
  {
    topoKey: "CANARIAS",
    displayName: "Canarias",
    flagKey: "CANARIAS",
    dbKeys: ["CANARIAS", "ISLAS_CANARIAS"],
  },
  {
    topoKey: "CANTABRIA",
    displayName: "Cantabria",
    flagKey: "CANTABRIA",
    dbKeys: ["CANTABRIA"],
  },
  {
    topoKey: "CASTILLA_LA_MANCHA",
    displayName: "Castilla-La Mancha",
    flagKey: "CASTILLA_LA_MANCHA",
    dbKeys: ["CASTILLA_LA_MANCHA", "CASTILLA_LA_MANCHA_COMUNIDAD_AUTONOMA"],
  },
  {
    topoKey: "CASTILLA_LEON",
    displayName: "Castilla y León",
    flagKey: "CASTILLA_Y_LEON",
    dbKeys: ["CASTILLA_LEON", "CASTILLA_Y_LEON"],
  },
  {
    topoKey: "CATALUNA",
    displayName: "Cataluña",
    flagKey: "CATALUNYA",
    dbKeys: ["CATALUNA", "CATALUNYA"],
  },
  {
    topoKey: "CEUTA",
    displayName: "Ceuta",
    flagKey: "CEUTA",
    dbKeys: ["CEUTA", "CIUDAD_AUTONOMA_DE_CEUTA"],
  },
  {
    topoKey: "COMUNITAT_VALENCIANA",
    displayName: "Comunitat Valenciana",
    flagKey: "COMUNITAT_VALENCIANA",
    dbKeys: ["COMUNITAT_VALENCIANA", "COMUNIDAD_VALENCIANA", "VALENCIANA"],
  },
  {
    topoKey: "EXTREMADURA",
    displayName: "Extremadura",
    flagKey: "EXTREMADURA",
    dbKeys: ["EXTREMADURA"],
  },
  {
    topoKey: "GALICIA",
    displayName: "Galicia",
    flagKey: "GALICIA",
    dbKeys: ["GALICIA"],
  },
  {
    topoKey: "LA_RIOJA",
    displayName: "La Rioja",
    flagKey: "LA_RIOJA",
    dbKeys: ["LA_RIOJA", "RIOJA"],
  },
  {
    topoKey: "MADRID",
    displayName: "Madrid",
    flagKey: "MADRID",
    dbKeys: ["MADRID", "COMUNIDAD_DE_MADRID"],
  },
  {
    topoKey: "MELILLA",
    displayName: "Melilla",
    flagKey: "MELILLA",
    dbKeys: ["MELILLA", "CIUDAD_AUTONOMA_DE_MELILLA"],
  },
  {
    topoKey: "MURCIA",
    displayName: "Murcia",
    flagKey: "MURCIA",
    dbKeys: ["MURCIA", "REGION_DE_MURCIA"],
  },
  {
    topoKey: "NAVARRA",
    displayName: "Navarra",
    flagKey: "NAVARRA",
    dbKeys: ["NAVARRA", "COMUNIDAD_FORAL_DE_NAVARRA"],
  },
  {
    topoKey: "PAIS_VASCO",
    displayName: "País Vasco",
    flagKey: "PAIS_VASCO",
    dbKeys: ["PAIS_VASCO", "EUSKADI"],
  },
]

/** Build a reverse-lookup: DB territory_key → CCAA entry */
const DB_KEY_TO_CCAA = new Map<string, CcaaGeoEntry>()
for (const entry of CCAA_GEO) {
  for (const dbKey of entry.dbKeys) {
    DB_KEY_TO_CCAA.set(dbKey, entry)
  }
}

/** Build a topo-key lookup */
const TOPO_KEY_TO_CCAA = new Map<string, CcaaGeoEntry>()
for (const entry of CCAA_GEO) {
  TOPO_KEY_TO_CCAA.set(entry.topoKey, entry)
}

export function getCcaaByDbKey(dbKey: string): CcaaGeoEntry | undefined {
  return DB_KEY_TO_CCAA.get(dbKey)
}

export function getCcaaByTopoKey(topoKey: string): CcaaGeoEntry | undefined {
  return TOPO_KEY_TO_CCAA.get(topoKey)
}
