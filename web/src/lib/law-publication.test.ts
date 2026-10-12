import {expect,it} from 'vitest'
import fixture from './law-publication-fixture.json'
import {lawSnapshot,publishedBill} from './law-publication'
it('retains source dates, corrections and exact legislature/number boundaries',()=>{
 const s=lawSnapshot(fixture)!
 expect(s.selected).toBe(21)
 expect(publishedBill(s,'121/000001/0000',15)?.documents[0].commencement_date).toBe('2024-08-22')
 expect(publishedBill(s,'121/000004',15)?.documents[0].commencement_date).toBe('2025-01-02')
 expect(publishedBill(s,'121/000016',15)?.documents.filter(d=>d.kind==='correction')[0].commencement_date).toBeNull()
 expect(publishedBill(s,'121/000001',14)).toBeNull()
 expect(publishedBill(s,'121/000001/0001',15)).toBeNull()
})
it('rejects forged links, mismatched coverage, duplicate bills and impossible dates',()=>{
 for(const mutate of [
 (s:typeof fixture)=>{s.records[0].documents[0].boe_id='BOE-A-2024-9'},
 (s:typeof fixture)=>{s.records[0].source_url=s.records[0].source_url.replace('XV','XIV')},
 (s:typeof fixture)=>{s.records[0].documents[0].commencement_date='2024-02-31'},
 (s:typeof fixture)=>{s.documents++},
 (s:typeof fixture)=>{s.records[1]=s.records[0]},
 ]){const s=structuredClone(fixture);mutate(s);expect(lawSnapshot(s)).toBeNull()}
})
