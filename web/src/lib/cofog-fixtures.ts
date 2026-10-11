import { COFOG_FUNCTIONS, type CofogObservation } from "./cofog"
export function rows(total = 100, year = 2024): CofogObservation[] {
  return ["TOTAL", ...Object.keys(COFOG_FUNCTIONS)].map((function_code) => ({
    geo: "ES",
    sector: "S13",
    year,
    function_code,
    unit: "MIO_EUR",
    value: function_code === "TOTAL" ? total : total / 10,
    raw_data: {
      dataset: "gov_10a_exp",
      frequency: "A",
      na_item: "TE",
      mapping_version: "cofog-level1-v1",
      accounts_total: String(total),
      flags: [],
      retrieved_at: "2026-10-11T00:00:00Z",
    },
  }))
}
