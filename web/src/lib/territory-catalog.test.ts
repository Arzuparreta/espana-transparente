import { expect, it } from "vitest"
import { ignoredTerritoryParams, parseTerritoryDataset } from "./territory-catalog"

it("never offers a combined contracts + subsidies total", () => {
  expect(parseTerritoryDataset("all")).toBe("contracts")
  expect(parseTerritoryDataset("subsidies")).toBe("subsidies")
})

it("names every ignored URL value instead of substituting silently", () => {
  const keys = new Set(["MADRID"])
  expect(ignoredTerritoryParams({}, [2025], keys)).toEqual([])
  expect(ignoredTerritoryParams({ source: "contracts", metric: "records", year: "all", territory: "MADRID" }, [2025], keys)).toEqual([])
  expect(ignoredTerritoryParams({ source: "all", metric: "x", year: "1990", territory: "NOPE" }, [2025], keys)).toEqual(["fuente", "medida", "año", "territorio"])
})
