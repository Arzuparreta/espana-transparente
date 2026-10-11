import { CHAPTERS, type ExecutionObservation } from "./budget-execution"
export function executionFixture(): ExecutionObservation[] {
  const rows = Object.keys(CHAPTERS).map((chapter) => ({
    scope: "ES_STATE_BUDGET",
    period: "2025-12",
    chapter,
    credit: 10,
    committed: 8,
    obligations: 6,
    payments: 4,
    unit: "MILES_EUR",
    raw_data: {
      unit: "MILES_EUR",
      sheet: "GTOS 004",
      payment_basis: "current_budget",
      period: "2025-12",
      mapping_version: "igae-current-chapters-v1",
      workbook_sha256: "a".repeat(64),
      source_url: "https://www.igae.pap.hacienda.gob.es/report.xlsx",
      retrieved_at: "2026-10-12T00:00:00Z",
    },
  }))
  for (const [code, factor] of [
    ["NF", 7],
    ["FIN", 2],
    ["TOTAL", 9],
  ] as const) {
    const r = rows.find((r) => r.chapter === code)!
    r.credit *= factor
    r.committed *= factor
    r.obligations *= factor
    r.payments *= factor
  }
  return rows
}
