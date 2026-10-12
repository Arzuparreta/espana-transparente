import { REGIONS, type Observation } from "./autonomic-liquidation";
import { CHAPTERS } from "./budget-execution";
export function liquidationFixture(): Observation[] {
  return Object.entries(REGIONS).flatMap(([territory, r]) =>
    Object.keys(CHAPTERS).map((chapter) => {
      const factor =
        chapter === "NF"
          ? 7
          : chapter === "FIN"
            ? 2
            : chapter === "TOTAL"
              ? 9
              : 1;
      return {
        territory,
        year: 2024,
        chapter,
        initial: 10 * factor,
        credit: 12 * factor,
        obligations: 8 * factor,
        payments: 6 * factor,
        unit: "MILES_EUR",
        raw_data: {
          year: 2024,
          hacienda_code: r.code,
          source_url: `https://serviciostelematicosext.hacienda.gob.es/SGCIEF/PublicacionLiquidaciones/aspx/DescargaEconomicaDC.aspx?cdcdad=${r.code}&ano=2024`,
          unit: "MILES_EUR",
          perimeter: "consolidated_budget",
          status: "definitive",
          mapping_version: "hacienda-liquidation-v1",
          workbook_sha256: "a".repeat(64),
          retrieved_at: "2026-10-12T00:00:00Z",
        },
      };
    }),
  );
}
