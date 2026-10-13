import { expect, it, vi } from "vitest"
import fixture from "@/lib/cohesion-program-fixture.json"
const mock=vi.hoisted(()=>({result:{data:null,error:null} as {data:unknown,error:unknown},from:vi.fn()}))
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}))
vi.mock("@/lib/supabase/public",()=>({supabase:{from:mock.from}}))
import { getCohesionProgrammes } from "./cohesion-program"
it("keeps absent, failed and malformed reads distinct",async()=>{
 mock.from.mockImplementation(()=>{const q={select:()=>q,eq:()=>q,abortSignal:()=>q,maybeSingle:()=>Promise.resolve(mock.result)};return q})
 mock.result={data:{metadata:fixture},error:null};expect((await getCohesionProgrammes()).snapshot?.programmes).toHaveLength(22)
 mock.result={data:{metadata:{}},error:null};expect((await getCohesionProgrammes()).error).toBe(true)
 mock.result={data:null,error:null};expect(await getCohesionProgrammes()).toEqual({snapshot:null,error:false})
 mock.result={data:null,error:{message:"timeout"}};expect((await getCohesionProgrammes()).error).toBe(true)
})
