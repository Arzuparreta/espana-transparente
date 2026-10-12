import { renderToStaticMarkup } from "react-dom/server"
import { expect,it,vi } from "vitest"
import { ParliamentActivity } from "./ParliamentActivity"
import { activityFixture } from "@/lib/parliament-activity-fixtures"
vi.mock("next/navigation",()=>({usePathname:()=>"/temas/vivienda",useRouter:()=>({prefetch:vi.fn()}),useSearchParams:()=>new URLSearchParams()}))
it("labels title evidence, kind, roles and unclassified coverage without inferring time or an author",()=>{
 const html=renderToStaticMarkup(<ParliamentActivity data={activityFixture()}/>)
 for(const text of ["no horas de debate","no incluyen por sí solas el voto nominal","no convierte al orador en proponente","no activan esa señal","housing-title-words-v1","Este registro no identifica un orador","Diario oficial"] )expect(html).toContain(text)
})
it("keeps request failure and absent year distinct and retains year in pagination",()=>{
 expect(renderToStaticMarkup(<ParliamentActivity data={{coverage:null,rows:[],error:true}}/>)).toContain('role="alert"')
 expect(renderToStaticMarkup(<ParliamentActivity data={{...activityFixture(),year:undefined,rows:[]}}/>)).toContain('role="status"')
 const data=activityFixture();data.rows=Array.from({length:31},(_,i)=>({...data.rows[0],id:String(i)}))
 const html=renderToStaticMarkup(<ParliamentActivity data={data}/>);expect(html).toContain('year=2024&amp;page=2')
 expect(html.match(/Señal del título/g)).toHaveLength(30)
})
