import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import fixture from '@/lib/wage-distribution-fixture.json'
import {wageSnapshot} from '@/lib/wage-distribution'
import {WageDistribution} from './WageDistribution'
it('shows distribution, same-population comparison and monthly gross limits with official sources',()=>{
 const html=renderToStaticMarkup(<WageDistribution result={{data:wageSnapshot(fixture),error:false}} year="2024"/>)
 for(const text of ['Decil 10','No es el dinero neto','jornada parcial','primer límite inferior','No representa a toda','aproxima la mediana','action="/distribucion-salarial"'])expect(html).toContain(text)
 for(const n of [2385.6,2001.4])expect(html).toContain(n.toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1}))
 expect(html.match(/class="rounded border p-4 space-y-1"/g)).toHaveLength(10)
})
it('does not fall back on unsupported year, missing edition or query failure',()=>{
 expect(renderToStaticMarkup(<WageDistribution result={{data:wageSnapshot(fixture),error:false}} year="2030"/>)).toContain('No se sustituye')
 expect(renderToStaticMarkup(<WageDistribution result={{data:null,error:true}}/>)).toContain('role="alert"')
 expect(renderToStaticMarkup(<WageDistribution result={{data:null,error:false}}/>)).toContain('No hay una edición verificada')
})
