import { expect,it,vi } from "vitest"
import {renderToStaticMarkup} from "react-dom/server"
import fixture from "@/lib/cohesion-program-fixture.json"
import {validateCohesionSnapshot} from "@/lib/cohesion-program"
import {CohesionProgrammeView} from "./CohesionProgramme"
vi.mock("next/link",()=>({default:({children,...props}:React.ComponentProps<"a">)=><a {...props}>{children}</a>}))
vi.mock("@/components/navigation/NavigationProgress",()=>({ResponsiveLink:({children,...props}:React.ComponentProps<"a">)=><a {...props}>{children}</a>}))
const snapshot=validateCohesionSnapshot(fixture)!
it("explains phase, denominator, version and independent selectors",()=>{
 const programme=snapshot.programmes.find(p=>p.cci==="2014ES16RFOP007")!
 const html=renderToStaticMarkup(<CohesionProgrammeView snapshot={snapshot} programme={programme} implementationYear="2023" paymentYear="2026"/>)
 for(const text of ["name=\"implementationYear\"","name=\"paymentYear\"","cofinanciación nacional","certificado o reembolsado","no pagos","no MRR ni PAC","No sumar los cortes anuales","Versión de programa","99js-gm52","gayr-92qh"])expect(html).toContain(text)
 expect(html).toContain("implementationYear=2023&amp;paymentYear=2026")
})
it("shows the available cut when the other independent cut is unavailable",()=>{
 const html=renderToStaticMarkup(<CohesionProgrammeView snapshot={snapshot} programme={snapshot.programmes[1]} implementationYear="2026" paymentYear="2026"/>)
 expect(html).toContain("año de implementación solicitado no está disponible")
 expect(html).toContain("Prefinanciación neta")
})
