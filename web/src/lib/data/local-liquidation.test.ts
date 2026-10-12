import {expect,it,vi} from 'vitest'
import fixture from '@/lib/local-liquidation-fixture.json'
const mock=vi.hoisted(()=>({result:{data:null,error:null} as {data:unknown;error:unknown},from:vi.fn()}))
vi.mock('next/cache',()=>({unstable_cache:(f:unknown)=>f}))
vi.mock('@/lib/supabase/client',()=>({supabase:{from:mock.from}}))
import {getLocalLiquidation} from './local-liquidation'
it('keeps malformed or failed reads distinct from missing publication',async()=>{
 mock.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>Promise.resolve(mock.result)};return q})
 mock.result={data:{metadata:fixture},error:null};expect((await getLocalLiquidation()).data?.records).toHaveLength(88)
 mock.result={data:{metadata:{}},error:null};expect((await getLocalLiquidation()).error).toBe(true)
 mock.result={data:null,error:null};expect(await getLocalLiquidation()).toEqual({data:null,error:false})
 mock.result={data:null,error:{message:'timeout'}};expect((await getLocalLiquidation()).error).toBe(true)
})
