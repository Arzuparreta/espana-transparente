import {it,expect} from 'vitest'
import fixture from './local-liquidation-fixture.json'
import {localSnapshot,localRatio,selectLocal} from './local-liquidation'
it('validates municipal stages, coverage and missing totals without reconstructing them',()=>{
 const s=localSnapshot(fixture)!
 expect(s.records).toHaveLength(88);expect(s.missing_cells).toBe(43);expect(s.complete_comparisons).toBe(85)
 expect(s.records.find(r=>r.territory==='35023')?.rows.NF).toEqual([25963865,null,null,null])
 expect(s.records.find(r=>r.territory==='38013_2007')?.name).toBe('Frontera')
})
it('rejects contradictory unit, sums, coverage, missing counts and territory',()=>{
 const mutations=[
  (s:typeof fixture)=>{s.unit='MILES_EUR'},
  (s:typeof fixture)=>{s.records.pop()},
  (s:typeof fixture)=>{s.records[0].territory='28079'},
  (s:typeof fixture)=>{s.records[0].rows.NF[0]=1},
  (s:typeof fixture)=>{s.missing_cells=0},
  (s:typeof fixture)=>{s.reconciled_checks=1056},
 ]
 for(const mutate of mutations){const s=structuredClone(fixture);mutate(s);expect(localSnapshot(s)).toBeNull()}
})
it('keeps unsupported and repeated filters unavailable and preserves zero versus missing denominators',()=>{
 const s=localSnapshot(fixture)!
 expect(selectLocal(s).available).toBe(true)
 expect(selectLocal(s,'2024','38013_2007').selected?.name).toBe('Frontera')
 for(const [year,t] of [['2023','35004'],['2024','ES708'],['2024','28079'],[['2024'],'all'],['2024',['35004']]])expect(selectLocal(s,year,t).available).toBe(false)
 expect(localRatio(0,100)).toBe(0);expect(localRatio(null,100)).toBeNull();expect(localRatio(0,0)).toBeNull();expect(localRatio(100,null)).toBeNull()
})
