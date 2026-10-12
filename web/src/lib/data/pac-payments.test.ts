import {expect,it,vi} from "vitest"
import fixture from "@/lib/pac-payment-fixture.json"
const mock=vi.hoisted(()=>({from:vi.fn(),result:{data:null,error:null} as {data:unknown,error:unknown}}))
vi.mock("next/cache",()=>({unstable_cache:(f:unknown)=>f}))
vi.mock("@/lib/supabase/client",()=>({supabase:{from:mock.from}}))
import {getPacPayments} from "./pac-payments"
it("distinguishes a missing publication from query failure or a malformed edition",async()=>{
 mock.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>Promise.resolve(mock.result)};return q})
 mock.result={data:{metadata:fixture},error:null};expect((await getPacPayments()).snapshot?.exercise).toBe(2025)
 mock.result={data:{metadata:{}},error:null};expect((await getPacPayments()).error).toBe(true)
 mock.result={data:null,error:null};expect(await getPacPayments()).toEqual({snapshot:null,error:false})
 mock.result={data:null,error:{message:"timeout"}};expect((await getPacPayments()).error).toBe(true)
})
