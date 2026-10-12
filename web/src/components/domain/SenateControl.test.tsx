import { renderToStaticMarkup } from "react-dom/server"
import { expect,it,vi } from "vitest"
import { SenateControl } from "./SenateControl"
import { senateFixture } from "@/lib/senate-control-fixtures"
vi.mock("next/navigation",()=>({usePathname:()=>"/actividad-senado",useRouter:()=>({prefetch:vi.fn()}),useSearchParams:()=>new URLSearchParams()}))
it("separates filings, authors, actors and missing roles from laws and debate time",()=>{
 const html=renderToStaticMarkup(<SenateControl result={{data:senateFixture(),error:false}} year="2024"/>);
 for(const text of ["Año de presentación","no es una ley","Persona autora","Otra persona","Rol no indicado","no convierte a la persona en autora","Áreas oficiales","Vivienda"])expect(html).toContain(text)
})
it("does not silently substitute another year or turn failure into zero",()=>{
 expect(renderToStaticMarkup(<SenateControl result={{data:senateFixture(),error:false}} year="2025"/>)).toContain("No se sustituye por otro")
 expect(renderToStaticMarkup(<SenateControl result={{data:null,error:true}}/>)).toContain('role="alert"')
})
