import {renderToStaticMarkup} from 'react-dom/server'
import {expect,it} from 'vitest'
import fixture from '@/lib/law-publication-fixture.json'
import {lawSnapshot,publishedBill} from '@/lib/law-publication'
import {LawPublication} from './LawPublication'
it('shows documentary link, literal source dates and differentiated application',()=>{
 const s=lawSnapshot(fixture)!
 const html=renderToStaticMarkup(<LawPublication result={{bill:publishedBill(s,'121/000004',15),checkedAt:s.retrieved_at,error:false}}/>)
 for(const text of ['2/4/2025','2/1/2025','precede a la publicación','disposiciones transitorias','PDF enlazado por Congreso','BOE-A-2025-6597'])expect(html).toContain(text)
})
it('does not treat a correction or absent link as another law or no publication',()=>{
 const s=lawSnapshot(fixture)!
 expect(renderToStaticMarkup(<LawPublication result={{bill:publishedBill(s,'121/000016',15),checkedAt:s.retrieved_at,error:false}}/>)).toContain('No se trata como otra ley')
 expect(renderToStaticMarkup(<LawPublication result={{bill:null,checkedAt:null,error:true}}/>)).toContain('role="alert"')
 expect(renderToStaticMarkup(<LawPublication result={{bill:null,checkedAt:null,error:false}}/>)).toContain('no demuestra que no exista')
})
