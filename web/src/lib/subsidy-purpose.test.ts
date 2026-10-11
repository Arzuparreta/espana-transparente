import { expect, it } from "vitest"
import { decodePurposeGroups, purposeYear } from "./subsidy-purpose"
const group = {
  finalidad: "Agricultura",
  classification: "classified",
  instrumento: "Subvención",
  grant_count: 3,
  call_count: 1,
  known_amount: "0",
  unknown_amount_count: 0,
  negative_amount_count: 0,
  last_checked: "2026-10-11T00:00:00Z",
}
it("keeps real zero, null amounts and each instrument separate", () => {
  expect(decodePurposeGroups([group])[0].known_amount).toBe(0)
  const rows = decodePurposeGroups([
    group,
    {
      ...group,
      instrumento: "Préstamo",
      known_amount: null,
      unknown_amount_count: 3,
    },
  ])
  expect(rows[1].known_amount).toBeNull()
  expect(rows[0].instrumento).not.toBe(rows[1].instrumento)
})
it("rejects inconsistent classification, amounts and counts", () => {
  for (const change of [
    { known_amount: "NaN" },
    { grant_count: null },
    { unknown_amount_count: 4 },
    { classification: "pending" },
    { finalidad: null },
    { known_amount: null },
  ])
    expect(() => decodePurposeGroups([{ ...group, ...change }])).toThrow()
})
it("does not silently change an invalid requested year", () => {
  expect(purposeYear(undefined, 2026)).toBe(2026)
  expect(purposeYear("2024", 2026)).toBe(2024)
  for (const input of ["2024junk", ["2024"], "", "2013"])
    expect(purposeYear(input, 2026)).toBeNull()
})
