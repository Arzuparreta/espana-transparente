import {expect,it,vi} from 'vitest'
import fixture from '@/lib/law-publication-fixture.json'
const mock=vi.hoisted(()=>({results:{} as Record<string,{data:unknown;error:unknown}>,from:vi.fn()}))
vi.mock('next/cache',()=>({unstable_cache:(f:unknown)=>f}))
vi.mock('@/lib/supabase/public',()=>({supabase:{from:mock.from}}))
import {getLawPublication} from './law-publication'
it('checks actual legislature and preserves query failures',async()=>{
 mock.from.mockImplementation((table:string)=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>Promise.resolve(mock.results[table])};return q})
 mock.results={law_publication_snapshot:{data:{metadata:fixture},error:null},legislatures:{data:{number:15},error:null}}
 expect((await getLawPublication('121/000001','id')).bill?.documents[0].boe_id).toBe('BOE-A-2024-15936')
 mock.results.legislatures.data={number:14};expect((await getLawPublication('121/000001','id')).bill).toBeNull()
 mock.results.legislatures.error={message:'timeout'};expect((await getLawPublication('121/000001','id')).error).toBe(true)
 mock.results.legislatures={data:{number:15},error:null};mock.results.law_publication_snapshot.data={metadata:{}};expect((await getLawPublication('121/000001','id')).error).toBe(true)
})
