import { renderToStaticMarkup } from "react-dom/server"
import { expect,it } from "vitest"
import { ParliamentEvidence } from "./ParliamentEvidence"
it("separates process, speakers, debate and law evidence",()=>{
 const html=renderToStaticMarkup(<ParliamentEvidence raw={{presentation_date:"2024-01-01",official:{PONENTES:"Persona",TRAMITACIONSEGUIDA:"Comisión\nInforme",ENLACESDS:"https://www.congreso.es/DS.PDF"}}} sourceUrl="https://www.congreso.es/expediente"/>);
 for(const t of ["Comisión","Diario de sesiones","autor individual","No hay publicación en BOE","no se calcula",'href="https://www.congreso.es/expediente"'])expect(html.toLowerCase()).toContain(t.toLowerCase())
})
