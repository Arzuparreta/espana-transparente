import { describe, expect, it } from "vitest"
import fixture from "./service-waiting.fixture.json"
import { validateWaitingSnapshot, selectWaitingRow } from "./service-waiting"
describe("SISLE edition", () => {
  it("reconciles the corrected SNS total and retains the official weighted mean", () => {
    const snapshot = validateWaitingSnapshot(fixture)!
    expect(snapshot).not.toBeNull()
    expect(selectWaitingRow(snapshot)?.patients).toBe(853740)
    expect(selectWaitingRow(snapshot)?.mean_days).toBe(122)
    expect(selectWaitingRow(snapshot, "08")?.patients).toBe(36491)
  })
  it.each(["08x", "8", "99", "", ["08", "13"]])(
    "rejects unsupported or repeated territory %s",
    (value) => {
      expect(
        selectWaitingRow(validateWaitingSnapshot(fixture)!, value),
      ).toBeUndefined()
    },
  )
  it.each(["2024-12-31", "", ["2025-12-31"]])(
    "does not fall back from an invalid cut %s",
    (cut) => {
      expect(
        selectWaitingRow(validateWaitingSnapshot(fixture)!, "ES", cut),
      ).toBeUndefined()
    },
  )
  it("rejects incomplete, duplicate, non-finite, wrong-denominator or obsolete snapshots", () => {
    const corruptions = [
      { ...fixture, rows: fixture.rows.slice(1) },
      {
        ...fixture,
        rows: fixture.rows.map((r, i) => (i === 1 ? fixture.rows[0] : r)),
      },
      {
        ...fixture,
        rows: fixture.rows.map((r, i) =>
          i === 0 ? { ...r, patients: r.patients + 1 } : r,
        ),
      },
      {
        ...fixture,
        rows: fixture.rows.map((r, i) => (i === 0 ? { ...r, rate: NaN } : r)),
      },
      {
        ...fixture,
        rows: fixture.rows.map((r, i) =>
          i === 0 ? { ...r, mean_days: null } : r,
        ),
      },
      { ...fixture, denominator: "INE-residents" },
      { ...fixture, revision_date: "2026-04-01" },
      {
        ...fixture,
        source_url: fixture.source_url.replace("_rectificado", ""),
      },
      { ...fixture, sha256: {} },
    ]
    for (const value of corruptions)
      expect(validateWaitingSnapshot(value)).toBeNull()
  })
})
