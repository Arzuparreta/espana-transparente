import { beforeEach,expect,it,vi } from "vitest"
const mocks=vi.hoisted(()=>({from:vi.fn(),results:{} as Record<string,{data:unknown;error:unknown}>}))
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}))
vi.mock("@/lib/supabase/public",()=>({supabase:{from:mocks.from}}))
import { getParliamentActivity } from "./parliament-activity"
import { activityFixture } from "@/lib/parliament-activity-fixtures"
beforeEach(()=>{
 const fixture=activityFixture();mocks.results={parliament_activity_coverage:{data:{metadata:fixture.coverage},error:null},parliament_activity:{data:fixture.rows,error:null}}
 mocks.from.mockImplementation((table:string)=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,gte:()=>q,lt:()=>q,abortSignal:()=>q,maybeSingle:()=>q,then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(mocks.results[table]).then(resolve)};return q})
})
it("distinguishes a real empty coverage, invalid year and consultation failure",async()=>{
 expect((await getParliamentActivity()).rows).toHaveLength(2)
 expect((await getParliamentActivity('2025')).year).toBeUndefined()
 mocks.results.parliament_activity_coverage={data:null,error:{message:'statement timeout'}}
 expect((await getParliamentActivity()).error).toBe(true)
 mocks.results.parliament_activity_coverage={data:null,error:null}
 expect((await getParliamentActivity()).error).toBe(false)
})
it("rejects a partial year instead of publishing unreconciled counts",async()=>{
 mocks.results.parliament_activity={data:[activityFixture().rows[0]],error:null}
 expect((await getParliamentActivity()).error).toBe(true)
})
