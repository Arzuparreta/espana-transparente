import { expect, it } from "vitest";
import { liquidationData, selectLiquidation } from "./autonomic-liquidation";
import { liquidationFixture } from "./autonomic-liquidation-fixtures";
it("requires 17 complete reconciled administrations and preserves URL context", () => {
  const data = liquidationData(liquidationFixture());
  expect(data.regions).toHaveLength(17);
  expect(
    selectLiquidation(data.regions, "2024", "ANDALUCIA").selected?.rows.NF
      .initial,
  ).toBe(70);
  expect(selectLiquidation(data.regions, "2025", "ANDALUCIA").available).toBe(
    false,
  );
  expect(selectLiquidation(data.regions, ["2024"], "ANDALUCIA").available).toBe(
    false,
  );
  expect(selectLiquidation(data.regions, "2024", "unknown").available).toBe(
    false,
  );
});
it.each(["missing", "sum", "scope", "source", "hash", "unit", "null-total"])(
  "retains the comparison when %s invalidates an administration",
  (issue) => {
    const rows = liquidationFixture();
    if (issue === "missing") rows.pop();
    if (issue === "sum") rows[0].credit = 500;
    if (issue === "scope") rows[0].raw_data!.perimeter = "unconsolidated";
    if (issue === "source")
      rows[0].raw_data!.source_url = "https://example.com";
    if (issue === "hash") rows[0].raw_data!.workbook_sha256 = "b".repeat(64);
    if (issue === "unit") rows[0].unit = "EUR";
    if (issue === "null-total")
      rows.find((r) => r.chapter === "NF")!.payments = null;
    expect(liquidationData(rows).regions).toEqual([]);
  },
);
