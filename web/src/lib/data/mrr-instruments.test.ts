import {expect,it,vi} from "vitest"
import fixture from "@/lib/mrr-instrument-fixture.json"
const mock=vi.hoisted(()=>({from:vi.fn(),result:{data:null,error:null} as {data:unknown,error:unknown}}))
vi.mock("next/cache",()=>({unstable_cache:(f:unknown)=>f}))
vi.mock("@/lib/supabase/public",()=>({supabase:{from:mock.from}}))
import {getMrrInstruments} from "./mrr-instruments"
it("distinguishes a missing publication from query failure or a malformed edition",async()=>{
 mock.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>Promise.resolve(mock.result)};return q})
 mock.result={data:{metadata:fixture},error:null};expect((await getMrrInstruments()).snapshot?.scope).toBe("ico-2026")
 mock.result={data:{metadata:{}},error:null};expect((await getMrrInstruments()).error).toBe(true)
 mock.result={data:null,error:null};expect(await getMrrInstruments()).toEqual({snapshot:null,error:false})
 mock.result={data:null,error:{message:"timeout"}};expect((await getMrrInstruments()).error).toBe(true)
})
