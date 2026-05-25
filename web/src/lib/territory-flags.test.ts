import { describe, expect, it } from "vitest"
import { getTerritoryFlag, normalizeTerritoryFlagKey } from "./territory-flags"

describe("territory flags", () => {
  it("normalizes accents and punctuation in territory names", () => {
    expect(normalizeTerritoryFlagKey("Castilla-La Mancha")).toBe("CASTILLA_LA_MANCHA")
    expect(normalizeTerritoryFlagKey("País Vasco")).toBe("PAIS_VASCO")
  })

  it("resolves common CCAA display variants", () => {
    expect(getTerritoryFlag("Comunidad de Madrid")?.src).toBe("/ccaa-flags/madrid.svg")
    expect(getTerritoryFlag("Madrid")?.src).toBe("/ccaa-flags/madrid.svg")
    expect(getTerritoryFlag("Euskadi")?.src).toBe("/ccaa-flags/pais-vasco.svg")
    expect(getTerritoryFlag("País Vasco")?.src).toBe("/ccaa-flags/pais-vasco.svg")
    expect(getTerritoryFlag("Islas Baleares")?.src).toBe("/ccaa-flags/illes-balears.svg")
    expect(getTerritoryFlag("Comunitat Valenciana")?.src).toBe("/ccaa-flags/comunitat-valenciana.svg")
  })

  it("uses the CCAA flag when the source territory is provincial", () => {
    expect(getTerritoryFlag("Zaragoza")?.src).toBe("/ccaa-flags/aragon.svg")
    expect(getTerritoryFlag("A Coruña")?.src).toBe("/ccaa-flags/galicia.svg")
    expect(getTerritoryFlag("Santa Cruz de Tenerife")?.src).toBe("/ccaa-flags/canarias.svg")
    expect(getTerritoryFlag("Castellón")?.src).toBe("/ccaa-flags/comunitat-valenciana.svg")
    expect(getTerritoryFlag("Alicante/Alacant")?.src).toBe("/ccaa-flags/comunitat-valenciana.svg")
    expect(getTerritoryFlag("La Gomera")?.src).toBe("/ccaa-flags/canarias.svg")
    expect(getTerritoryFlag("Ciudad Autónoma de Melilla")?.src).toBe("/ccaa-flags/melilla.svg")
  })
})
