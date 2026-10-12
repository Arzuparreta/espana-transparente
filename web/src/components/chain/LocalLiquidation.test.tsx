import {it,expect,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import fixture from '@/lib/local-liquidation-fixture.json'
import {localSnapshot} from '@/lib/local-liquidation'
import {LocalLiquidation} from './LocalLiquidation'
vi.mock('next/link',()=>({default:({children,...props}:React.ComponentProps<'a'>)=><a {...props}>{children}</a>}))
const data=localSnapshot(fixture)
it('distinguishes authorization, recognized spending and current-year payments',()=>{
 const html=renderToStaticMarkup(<LocalLiquidation result={{data,error:false}} year="2024" municipality="35004"/>)
 for(const text of ['Arrecife','Presupuesto inicial','Presupuesto definitivo','Obligaciones reconocidas de 2024','Pagos líquidos del ejercicio corriente','excluyen los de ejercicios cerrados','no acredita una decisión personal','ISTAC'])expect(html).toContain(text)
 expect(html).toContain('name="year"');expect(html).toContain('name="municipality"')
})
it('does not reconstruct an unavailable total, while retaining the municipality',()=>{
 const html=renderToStaticMarkup(<LocalLiquidation result={{data,error:false}} municipality="35023"/>)
 expect(html).toContain('No disponible en fuente');expect(html).toContain('No calculable');expect(html).toContain('No se reconstruye un total ausente')
})
it('keeps query errors and places outside the pilot distinct from zero',()=>{
 expect(renderToStaticMarkup(<LocalLiquidation result={{data:null,error:true}}/>)).toContain('role="alert"')
 expect(renderToStaticMarkup(<LocalLiquidation result={{data,error:false}} municipality="28079"/>)).toContain('fuera de la cobertura')
 const html=renderToStaticMarkup(<LocalLiquidation result={{data,error:false}}/>)
 expect(html).toContain('85 de 88');expect(html).toContain('43 de 4224');expect(html).toContain('No se publica una suma parcial')
})
