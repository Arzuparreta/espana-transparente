import { expect, it } from "vitest"
import fixture from "./mrr-instrument-fixture.json"
import { mrrSnapshot, mrrYear } from "./mrr-instruments"
it("validates complete edition and retains published zeros and separate phases", () => {
  const s = mrrSnapshot(fixture)!
  expect(s.facilities[0].total_cents).toBe(30_000_000_000)
  expect(s.facilities[1].annualities[2].cents).toBe(19_200_000_000)
  expect(s.facilities[0].annualities[2].cents).toBe(0)
  expect(s.effectiveness).toBe("registration-not-verified")
})
it("rejects corrupt phase, duplicate year, lost instruments, unsafe precision and source", () => {
  for (const change of [
    (s: typeof fixture) => { s.stage = "payments" },
    (s: typeof fixture) => { s.facilities[0].annualities[0].year = 2026 },
    (s: typeof fixture) => { s.facilities[0].annualities[0].cents = 1 },
    (s: typeof fixture) => { s.facilities[0].annualities[0].cents = Number.MAX_SAFE_INTEGER+1 },
    (s: typeof fixture) => { s.instruments.pop() },
    (s: typeof fixture) => { s.sources.amendment.xml_url = "https://example.com" },
    (s: typeof fixture) => { s.signatories[0].role = "Autor de cada pago" },
  ]) {
    const value = structuredClone(fixture); change(value)
    expect(mrrSnapshot(value)).toBeNull()
  }
  expect(mrrSnapshot({})).toBeNull()
})
it("does not silently replace unsupported or repeated annualities", () => {
  expect(mrrYear()).toBe(2026)
  expect(mrrYear("2025")).toBe(2025)
  for (const year of ["2027", "", "02026", ["2024", "2026"]]) expect(mrrYear(year)).toBeNull()
})
