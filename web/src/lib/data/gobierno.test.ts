import { beforeEach,expect,it,vi } from "vitest"
const mocks=vi.hoisted(()=>({from:vi.fn(),calls:[] as unknown[],member:{id:"mandate-id",organization_name:"MINISTERIO",start_date:"2020-01-01"}}))
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}))
vi.mock("@/lib/supabase/public",()=>({supabase:{from:mocks.from}}))
import { getMinistrioDetail } from "./gobierno"
beforeEach(()=>{mocks.calls=[];mocks.from.mockImplementation((table:string)=>{
 const query={select:()=>query,eq:(...args:unknown[])=>{mocks.calls.push([table,...args]);return query},single:()=>Promise.resolve({data:mocks.member,error:null}),order:()=>query,limit:()=>Promise.resolve({data:[],error:null})};return query
})})
it("queries a mandate ID and EUR rather than a department's entire history",async()=>{
 await getMinistrioDetail("mandate-id")
 expect(mocks.calls).toContainEqual(["v_mandate_contracts","position_id","mandate-id"])
 expect(mocks.calls).toContainEqual(["v_mandate_contracts","currency","EUR"])
})
