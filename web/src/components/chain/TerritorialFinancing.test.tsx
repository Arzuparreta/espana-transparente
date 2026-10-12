import {it,expect,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import fixture from '@/lib/territorial-financing-fixture.json'
import {financingSnapshot} from '@/lib/territorial-financing'
import {TerritorialFinancing} from './TerritorialFinancing'
vi.mock('next/link',()=>({default:({children,...props}:React.ComponentProps<'a'>)=><a {...props}>{children}</a>}))
const data=financingSnapshot(fixture)
it('explains gross settlement and preserves separate phases in a region',()=>{
 const html=renderToStaticMarkup(<TerritorialFinancing result={{data,error:false}} year="2024" territory="05"/>)
 for(const text of ['Canarias','anticipos concedidos en 2026','No numérico','Entregas a cuenta de 2024','no es toda la financiación','no significa ausencia de imposición','Cuadros oficiales XLSX'])expect(html).toContain(text)
 expect(html).toContain('name="year"');expect(html).toContain('name="territory"')
})
it('does not substitute total or zero for an unsupported selection or error',()=>{
 const absent=renderToStaticMarkup(<TerritorialFinancing result={{data,error:false}} territory="14"/>)
 expect(absent).toContain('régimen foral');expect(absent).not.toContain('saldo global bruto</h2>')
 const error=renderToStaticMarkup(<TerritorialFinancing result={{data:null,error:true}}/>)
 expect(error).toContain('role="alert"');expect(error).toContain('fallo no se presenta como cero')
})
