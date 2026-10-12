import {expect,it} from 'vitest'
import fixture from './wage-distribution-fixture.json'
import {wageSnapshot,wageYear} from './wage-distribution'
it('retains current edition and year boundaries without averaging unweighted decile means',()=>{
 const s=wageSnapshot(fixture)!
 expect(s.years[0].mean).toBe(2385.6)
 expect(wageYear(s,'2021')?.mean).toBe(2076.5)
 for(const input of ['2020','2025','2024junk',['2024','2023']])expect(wageYear(s,input)).toBeNull()
 expect(wageYear(s)?.year).toBe(2024)
})
it('rejects failed reconciliation, duplicate years, missing lower boundary and untrusted provenance',()=>{
 for(const mutate of [
 (s:typeof fixture)=>{s.years[0].mean=1},
 (s:typeof fixture)=>{s.years.push(s.years[0])},
 (s:typeof fixture)=>{s.years[0].bands[2].lower=null},
 (s:typeof fixture)=>{s.sources['66237']='https://example.com'},
 (s:typeof fixture)=>{s.years[0].bands[0].count_thousands=1},
 ]){const s=structuredClone(fixture);mutate(s);expect(wageSnapshot(s)).toBeNull()}
})
