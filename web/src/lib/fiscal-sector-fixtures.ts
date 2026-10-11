import { SECTORS, SECTOR_ITEMS, type SectorObservation } from "./fiscal-sectors"
export function sectorRows(): SectorObservation[] {
  return Object.keys(SECTORS).flatMap((sector) =>
    SECTOR_ITEMS.map((item, index) => ({
      geo: "ES",
      sector,
      year: 2024,
      item,
      value: (sector === "S13" ? [100, 120, -20] : [50, 55, -5])[index],
      unit: "MIO_EUR",
      raw_data: {
        dataset: "gov_10a_main",
        unit: "MIO_EUR",
        frequency: "A",
        mapping_version: "esa-sectors-v1",
        retrieved_at: "2026-10-11T00:00:00Z",
        flags: [],
      },
    })),
  )
}
