import { beforeEach,expect,it,vi } from "vitest"
const mocks=vi.hoisted(()=>({from:vi.fn(),calls:[] as unknown[]}))
vi.mock("next/cache",()=>({unstable_cache:(fn:unknown)=>fn}))
vi.mock("@/lib/supabase/client",()=>({supabase:{from:mocks.from}}))
import { getInitiativeDetail } from "./conexiones"
import { getVotingDetailData } from "./voting"
beforeEach(()=>{mocks.calls=[];mocks.from.mockImplementation((table:string)=>{
 const data=table==="initiatives"?{number:"121/000001/0000",legislature_id:"leg-15"}:table==="voting_sessions"?{initiative_number:"121/000001",legislature_id:"leg-15"}:[]
 const q={select:()=>q,eq:(...a:unknown[])=>{mocks.calls.push([table,"eq",...a]);return q},in:(...a:unknown[])=>{mocks.calls.push([table,"in",...a]);return q},single:()=>Promise.resolve({data,error:null}),order:()=>q,maybeSingle:()=>Promise.resolve({data,error:null}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data,error:null}).then(resolve)};return q
})})
it("scopes links in both directions to the same legislature and official empty-suffix variants",async()=>{
 await getInitiativeDetail("id")
 expect(mocks.calls).toContainEqual(["v_voting_session_summary","eq","legislature_id","leg-15"])
 expect(mocks.calls).toContainEqual(["v_voting_session_summary","in","initiative_number",["121/000001","121/000001/0000"]])
 await getVotingDetailData("vote-id")
 expect(mocks.calls).toContainEqual(["initiatives","eq","legislature_id","leg-15"])
})
