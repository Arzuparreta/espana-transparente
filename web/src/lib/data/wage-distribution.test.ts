import {expect,it,vi} from 'vitest'
import fixture from '@/lib/wage-distribution-fixture.json'
const mock=vi.hoisted(()=>({result:{data:null,error:null} as {data:unknown;error:unknown},from:vi.fn()}))
vi.mock('next/cache',()=>({unstable_cache:(f:unknown)=>f}))
vi.mock('@/lib/supabase/public',()=>({supabase:{from:mock.from}}))
import {getWageDistribution} from './wage-distribution'
it('separates verified data, missing coverage, inconsistent snapshots and database errors',async()=>{
 mock.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>Promise.resolve(mock.result)};return q})
 mock.result={data:{metadata:fixture},error:null};expect((await getWageDistribution()).data?.years).toHaveLength(4)
 mock.result={data:{metadata:{}},error:null};expect((await getWageDistribution()).error).toBe(true)
 mock.result={data:null,error:null};expect(await getWageDistribution()).toEqual({data:null,error:false})
 mock.result={data:null,error:{message:'timeout'}};expect((await getWageDistribution()).error).toBe(true)
})
