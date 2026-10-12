import { expect,it } from "vitest"
import { initiativeNumbers,officialDocumentUrls,parliamentEvidence } from "./parliament-evidence"
it("accepts the empty official suffix but preserves a substantive subfile",()=>{
 expect(initiativeNumbers("121/000001/0000")).toEqual(["121/000001","121/000001/0000"])
 expect(initiativeNumbers("122/000001/0001")).toEqual(["122/000001/0001"])
})
it("keeps only unique official document links",()=>{
 expect(officialDocumentUrls("https://www.congreso.es/a.PDF https://evil.test/a https://www.congreso.es/a.PDF https://www.boe.es/law")).toEqual(["https://www.congreso.es/a.PDF","https://www.boe.es/law"])
})
it("never turns approval into enactment or manufactures unknown dates",()=>{
 const e=parliamentEvidence({official:{RESULTADOTRAMITACION:"Aprobado",ENLACESBOCG:"https://www.congreso.es/a.PDF"}})
 expect(e.laws).toEqual([]);expect(e.presentation).toBeNull();expect(e.officialResult).toBe("Aprobado")
})
