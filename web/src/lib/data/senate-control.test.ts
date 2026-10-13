import { beforeEach,expect,it,vi } from "vitest"
const mocks=vi.hoisted(()=>({from:vi.fn(),results:{} as Record<string,{data:unknown;error:unknown}>}))
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}))
vi.mock("@/lib/supabase/public",()=>({supabase:{from:mocks.from}}))
import { getSenateControl } from "./senate-control"
import { senateFixture } from "@/lib/senate-control-fixtures"
beforeEach(()=>{
 const f=senateFixture();mocks.results={senate_control_coverage:{data:{metadata:f.metadata},error:null},senate_control_initiatives:{data:f.rows,error:null}}
 mocks.from.mockImplementation((table:string)=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,abortSignal:()=>q,maybeSingle:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(mocks.results[table]).then(resolve)};return q})
})
it("retains a mismatched snapshot and distinguishes empty coverage from failure",async()=>{
 expect((await getSenateControl()).data?.rows).toHaveLength(1)
 mocks.results.senate_control_initiatives={data:[],error:null};expect((await getSenateControl()).error).toBe(true)
 mocks.results.senate_control_coverage={data:null,error:null};expect((await getSenateControl()).error).toBe(false)
 mocks.results.senate_control_coverage={data:null,error:{message:'statement timeout'}};expect((await getSenateControl()).error).toBe(true)
})
