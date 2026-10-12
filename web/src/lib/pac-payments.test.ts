import {expect,it} from "vitest"
import fixture from "./pac-payment-fixture.json"
import {pacSnapshot,selectPac,pacEuro} from "./pac-payments"
it("keeps financial year, fund periods and both reconciled breakdowns",()=>{
 const s=pacSnapshot(fixture)!
 expect(s.period_start).toBe("2024-10-16")
 expect(s.programmes.feaga.categories.total_cents).toEqual([571903207575])
 expect(selectPac(s,"2025","feaga","08")?.selected?.label).toBe("CASTILLA-LA MANCHA")
 expect(selectPac(s,"2025","feader-2023-2027","FEGA")?.selected?.amounts_cents).toEqual([2951722994])
 expect(pacEuro(-430639)).toContain("-4306,39")
})
it("rejects unsupported repeated filters without silently selecting another scope",()=>{
 const s=pacSnapshot(fixture)!
 for(const [y,f,b] of [["2024","feaga","ES"],["2025","MRR","ES"],["2025","feaga","18"],[["2025"],"feaga","ES"],["2025",["feaga"],"ES"]])expect(selectPac(s,y,f,b)).toBeNull()
})
it("rejects source, range, coverage, identity and contradictory totals",()=>{
 const mutations=[(s:typeof fixture)=>{s.period_start="2025-01-01"},(s:typeof fixture)=>{s.source.pdf_url="https://other/document.pdf"},(s:typeof fixture)=>{s.programmes.feaga.categories.rows.pop()},(s:typeof fixture)=>{s.programmes.feaga.categories.total_cents[0]++},(s:typeof fixture)=>{s.programmes.feaga.territories.rows[0].code="FEGA"},(s:typeof fixture)=>{s.programmes["feader-2023-2027"].categories.rows[0].amounts_cents[0]=Number.MAX_SAFE_INTEGER+1}]
 for(const mutate of mutations){const s=structuredClone(fixture);mutate(s);expect(pacSnapshot(s)).toBeNull()}
})
