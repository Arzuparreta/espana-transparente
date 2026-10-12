import { expect, it } from "vitest"
import fixture from "./cohesion-program-fixture.json"
import { validateCohesionSnapshot, cohesionYears, selectCohesionYear, cohesionAmount, cohesionHref } from "./cohesion-program"
it("reconciles complete coverage with independent cumulative periods", () => {
 const s=validateCohesionSnapshot(fixture)!
 expect(s.programmes).toHaveLength(22)
 expect(cohesionYears(s,"implementation").at(-1)).toBe(2023)
 expect(cohesionYears(s,"payments").at(-1)).toBe(2026)
 expect(s.source_rows).toEqual({"99js-gm52":1849,"gayr-92qh":443})
})
it("rejects missing coverage, duplicate codes, unexpected periods and broken sums",()=>{
 const mutations=[(s:typeof fixture)=>{s.programmes.pop()},(s:typeof fixture)=>{s.programmes.push(s.programmes[0])},(s:typeof fixture)=>{s.programmes[0].implementation[0].year=2024},(s:typeof fixture)=>{s.programmes[0].implementation[0].known.planned_cents++},(s:typeof fixture)=>{s.sources["99js-gm52"].url="https://other/data"},(s:typeof fixture)=>{s.programmes[0].payments[0].missing.net_payments_cents=999}]
 for(const mutation of mutations){const s=structuredClone(fixture);mutation(s);expect(validateCohesionSnapshot(s)).toBeNull()}
})
it("keeps unsupported selections and absent amounts distinct from zero",()=>{
 expect(selectCohesionYear([2022,2023])).toBe(2023)
 for(const value of ["2026","2023x",["2023"],""])expect(selectCohesionYear([2022,2023],value)).toBeUndefined()
 const p={year:2023,title:"Test",source_rows:2,known:{value:0},missing:{value:2}}
 expect(cohesionAmount(p,"value")).toContain("No publicado")
 p.missing.value=1;expect(cohesionAmount(p,"value")).toContain("conocidos")
 p.missing.value=0;expect(cohesionAmount(p,"value")).toContain("0,00")
 expect(cohesionHref("2014ES16RFOP007",2023,2026)).toBe("/fondos-ue/cohesion/2014ES16RFOP007?implementationYear=2023&paymentYear=2026")
})
