import {expect,it} from 'vitest'
import fixture from './housing-prices-fixture.json'
import {housingSnapshot,housingSelection} from './housing-prices'
it('selects the actual period and region, retaining missing city types',()=>{
 const s=housingSnapshot(fixture)!
 expect(s.rows).toHaveLength(1456)
 expect(housingSelection(s)?.period).toBe('2026-Q2')
 expect(housingSelection(s,'2024-Q2','18')?.rows).toHaveLength(1)
 for(const [p,t] of [['2026-Q4','00'],['2024','00'],['2024-Q2','20'],[['2024-Q2'],'00']])expect(housingSelection(s,p,t)).toBeNull()
})
it('rejects empty, duplicate, unreconciled, wrong-base or untrusted snapshots',()=>{
 for(const mutate of [
 (s:typeof fixture)=>{s.rows[224].annual+=1},
 (s:typeof fixture)=>{s.rows.pop()},
 (s:typeof fixture)=>{s.rows.push(s.rows[0])},
 (s:typeof fixture)=>{s.base=2015},
 (s:typeof fixture)=>{s.source_url='https://example.com'},
 (s:typeof fixture)=>{s.missing.pop()},
 ]){const s=structuredClone(fixture);mutate(s);expect(housingSnapshot(s)).toBeNull()}
})
