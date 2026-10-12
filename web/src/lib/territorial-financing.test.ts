import {describe,it,expect} from 'vitest'
import fixture from './territorial-financing-fixture.json'
import {financingSnapshot,selectFinancing} from './territorial-financing'
describe('territorial financing settlement',()=>{
 it('validates official territories and preserves signs, blanks and cities',()=>{
  const s=financingSnapshot(fixture)!
  expect(s.records).toHaveLength(17)
  expect(s.records.find(r=>r.territory==='05')?.details.iva).toBeNull()
  expect(s.records.find(r=>r.territory==='03')?.balances.irpf).toBeLessThan(0)
  expect(s.records.find(r=>r.territory==='18')?.group).toBe('city')
 })
 it('rejects inconsistent coverage, phases, identities and units',()=>{
  const mutations=[
   (s:typeof fixture)=>{s.records.pop()},
   (s:typeof fixture)=>{s.records[0].territory='14'},
   (s:typeof fixture)=>{s.unit='EUR'},
   (s:typeof fixture)=>{s.records[0].balances.resources+=100},
   (s:typeof fixture)=>{s.totals['Total General'].total+=100},
   (s:typeof fixture)=>{s.records[0].details.irpf!.advance+=100},
   (s:typeof fixture)=>{s.source_url='https://evil.test/file'},
  ]
  for(const mutate of mutations){const s=structuredClone(fixture);mutate(s);expect(financingSnapshot(s)).toBeNull()}
 })
 it('keeps unsupported year, foral territory and repeated params outside the pilot',()=>{
  const s=financingSnapshot(fixture)!
  expect(selectFinancing(s).available).toBe(true)
  expect(selectFinancing(s,'2024','18').region?.name).toBe('Ceuta')
  for(const [year,territory] of [['2025','all'],['2024','14'],['2024','15'],[['2024'],'all'],['2024',['05']]])expect(selectFinancing(s,year,territory).available).toBe(false)
  expect(selectFinancing(null).available).toBe(false)
 })
})
