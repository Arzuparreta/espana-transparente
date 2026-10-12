import { renderToStaticMarkup } from "react-dom/server"
import { expect,it } from "vitest"
import { MandateEvidence } from "./MandateEvidence"
const responsible={person_name:"Persona",politician_id:null,official_id:null,ministry:"Departamento",government:null,political_party:null,start_date:"2020-01-01",end_date:null,relation_date:"2020-12-31",date_basis:"award_date",position_id:"mandate-id",candidate_count:2,match_method:"direct_department",mandate_source_url:"https://www.boe.es/nombramiento"}
it("shows mandate, event basis, evidence and ambiguity without claiming a personal action",()=>{
 const html=renderToStaticMarkup(<MandateEvidence responsible={responsible} recordSource="https://contrataciondelestado.es/registro"/>);
 for(const t of ["cese no registrado","adjudicación registrada","2 mandatos candidatos","Documento que respalda el cargo","mandate-id","no acredita una firma"])expect(html).toContain(t)
 expect(html).toContain('href="https://www.boe.es/nombramiento"')
})
it("labels publication fallback and absent documentary coverage",()=>{
 expect(renderToStaticMarkup(<MandateEvidence responsible={{...responsible,date_basis:"publication_date",mandate_source_url:null}}/>)).toContain("sin fecha de adjudicación")
 const html=renderToStaticMarkup(<MandateEvidence responsible={null}/>);expect(html).toContain("No hay un mandato asociado");expect(html).toContain("Documento de la actuación no disponible")
})
