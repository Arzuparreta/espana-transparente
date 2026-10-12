import { expect,it } from "vitest"
import { activityCoverage,selectActivityYear,validateActivity } from "./parliament-activity"
import { activityFixture } from "./parliament-activity-fixtures"
it("reconciles the universe and kind denominators with a strict requested year",()=>{
 const {coverage,rows}=activityFixture()
 expect(activityCoverage(coverage)).toEqual(coverage)
 expect(validateActivity(rows,"2024",coverage.years['2024'],coverage.dataset_sha256)).toBe(true)
 expect(selectActivityYear(coverage,"2025")).toBeUndefined();expect(selectActivityYear(coverage,["2024"])).toBeUndefined()
 expect(activityCoverage({...coverage,selected:3})).toBeNull()
})
it.each(["source","hash","duplicate","kind","year"])("retains the pilot on %s incoherence",issue=>{
 const {coverage,rows}=activityFixture()
 if(issue==="source")rows[0].documents=["https://evil.test/pdf"]
 if(issue==="hash")rows[0].dataset_sha256="d".repeat(64)
 if(issue==="duplicate")rows[0].id=rows[1].id
 if(issue==="kind")rows[0].kind="voting_record"
 if(issue==="year")rows[0].event_date="2025-01-01"
 expect(validateActivity(rows,"2024",coverage.years['2024'],coverage.dataset_sha256)).toBe(false)
})
