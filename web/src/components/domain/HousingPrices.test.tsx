import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import fixture from '@/lib/housing-prices-fixture.json'
import {housingSnapshot} from '@/lib/housing-prices'
import {HousingPrices} from './HousingPrices'
it('distinguishes time comparisons, index levels and household affordability',()=>{
 const html=renderToStaticMarkup(<HousingPrices result={{data:housingSnapshot(fixture),error:false}} period="2026-Q2" territory="00"/>)
 for(const text of ['+12,2 % anual','+3,4 % trimestral','2025=100','no dice dónde es más caro','No estima tu alquiler','sin impuestos','causalidad','name="period"','name="territory"'])expect(html).toContain(text)
})
it('does not fill city breakdowns or silently substitute invalid filters',()=>{
 expect(renderToStaticMarkup(<HousingPrices result={{data:housingSnapshot(fixture),error:false}} territory="18"/>)).toContain('Desglose no publicado')
 expect(renderToStaticMarkup(<HousingPrices result={{data:housingSnapshot(fixture),error:false}} period="2026-Q4"/>)).toContain('No se sustituye')
 expect(renderToStaticMarkup(<HousingPrices result={{data:null,error:true}}/>)).toContain('role="alert"')
})
