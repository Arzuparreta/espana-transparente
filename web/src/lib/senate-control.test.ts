import { expect,it } from "vitest"
import { senateControlData,selectSenateYear } from "./senate-control"
import { senateFixture } from "./senate-control-fixtures"
it("reconciles complete filings and distinguishes the requested year",()=>{
 const {rows,metadata}=senateFixture();expect(senateControlData(rows,metadata)).not.toBeNull()
 expect(selectSenateYear(metadata,"2025")).toBeUndefined();expect(selectSenateYear(metadata,["2024"])).toBeUndefined()
 expect(senateControlData(rows,{...metadata,selected:2})).toBeNull()
})
it.each(["duplicate","legislature","source","year","signal"])("retains the pilot when %s is inconsistent",issue=>{
 const {rows,metadata}=senateFixture()
 if(issue==="duplicate")rows.push(rows[0])
 if(issue==="legislature")rows[0].legislature=14
 if(issue==="source")rows[0].evidence.documents=[{url:"https://evil.test",kind:"diary",date:null,label:null}]
 if(issue==="year")metadata.years={"2025":1}
 if(issue==="signal")rows[0].evidence.title_signal="other word"
 expect(senateControlData(rows,metadata)).toBeNull()
})
